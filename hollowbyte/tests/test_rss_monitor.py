from __future__ import annotations

import subprocess
from collections.abc import Sequence
from io import StringIO
from pathlib import Path

import pytest

from hollowbyte_monitor.rss_monitor import (
    LookupStatus,
    MemorySample,
    MonitorConfig,
    MonitorError,
    MonitorErrorKind,
    ProcessMemory,
    SelectorKind,
    TargetSelector,
    aggregate_process_memory,
    build_parser,
    config_from_args,
    find_openssl_version,
    find_package_version,
    monitor,
    parse_proc_status,
    report_linked_libraries,
    resolve_port_pids,
    resolve_service_pids,
)


def completed(
    command: Sequence[str], stdout: str = "", stderr: str = "", returncode: int = 0
) -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess(command, returncode, stdout, stderr)


def test_parse_proc_status_extracts_memory_fields() -> None:
    status = """Name:\tproxy
VmHWM:\t  8192 kB
VmRSS:\t  6144 kB
RssAnon:\t  4096 kB
RssFile:\t  2048 kB
"""

    assert parse_proc_status(42, status) == ProcessMemory(
        pid=42,
        vmrss_kib=6144,
        vmhwm_kib=8192,
        rssanon_kib=4096,
    )


def test_parse_proc_status_rejects_missing_fields() -> None:
    with pytest.raises(MonitorError) as caught:
        parse_proc_status(42, "VmRSS:\t1024 kB\n")

    assert caught.value.kind is MonitorErrorKind.INVALID_STATUS
    assert "rssanon_kib" in caught.value.detail
    assert "vmhwm_kib" in caught.value.detail


def test_resolve_service_pid() -> None:
    commands: list[Sequence[str]] = []

    def runner(command: Sequence[str]) -> subprocess.CompletedProcess[str]:
        commands.append(command)
        return completed(command, stdout="1234\n")

    assert resolve_service_pids("kanidm.service", runner) == (1234,)
    assert commands == [("systemctl", "show", "--property", "MainPID", "--value", "kanidm.service")]


def test_resolve_inactive_service_is_typed() -> None:
    def runner(command: Sequence[str]) -> subprocess.CompletedProcess[str]:
        return completed(command, stdout="0\n")

    with pytest.raises(MonitorError) as caught:
        resolve_service_pids("kanidm.service", runner)

    assert caught.value.kind is MonitorErrorKind.TARGET_NOT_FOUND


def test_resolve_port_returns_all_unique_listener_pids() -> None:
    output = (
        'LISTEN 0 4096 *:443 *:* users:(("proxy",pid=300,fd=8),("proxy",pid=200,fd=8))\n'
        'LISTEN 0 4096 [::]:443 [::]:* users:(("proxy",pid=200,fd=9))\n'
    )

    def runner(command: Sequence[str]) -> subprocess.CompletedProcess[str]:
        return completed(command, stdout=output)

    assert resolve_port_pids(443, runner) == (200, 300)


def test_resolve_port_explains_hidden_pid() -> None:
    def runner(command: Sequence[str]) -> subprocess.CompletedProcess[str]:
        return completed(command, stdout="LISTEN 0 4096 *:443 *:*\n")

    with pytest.raises(MonitorError) as caught:
        resolve_port_pids(443, runner)

    assert caught.value.kind is MonitorErrorKind.PID_UNAVAILABLE
    assert "root" in caught.value.detail


def test_aggregate_process_memory_sums_worker_processes() -> None:
    sample = aggregate_process_memory(
        [
            ProcessMemory(pid=20, vmrss_kib=100, vmhwm_kib=150, rssanon_kib=80),
            ProcessMemory(pid=10, vmrss_kib=200, vmhwm_kib=250, rssanon_kib=160),
        ]
    )

    assert sample.pids == (10, 20)
    assert sample.vmrss_kib == 300
    assert sample.vmhwm_kib == 400
    assert sample.rssanon_kib == 240


def test_cli_requires_exactly_one_selector() -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args([])
    with pytest.raises(SystemExit):
        parser.parse_args(["--service", "kanidm", "--port", "443"])


def test_cli_builds_port_config() -> None:
    arguments = build_parser().parse_args(["--port", "443", "--interval", "0.25", "--samples", "4"])

    config = config_from_args(arguments)

    assert config.selector == TargetSelector(SelectorKind.PORT, "443")
    assert config.interval_seconds == 0.25
    assert config.sample_limit == 4


def test_cli_rejects_non_finite_interval() -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["--port", "443", "--interval", "nan"])


def test_linked_library_report_includes_openssl_and_dpkg_version(tmp_path: Path) -> None:
    proc_root = tmp_path / "proc"
    maps_path = proc_root / "42" / "maps"
    maps_path.parent.mkdir(parents=True)
    maps_path.write_text(
        "7f000000-7f001000 r--p 00000000 00:00 1 /usr/lib/libcrypto.so.3\n",
        encoding="utf-8",
    )
    stream = StringIO()

    def runner(command: Sequence[str]) -> subprocess.CompletedProcess[str]:
        if command[0] == "strings":
            return completed(command, stdout="OpenSSL 3.0.20 1 Jul 2026\n")
        if command[0] == "dpkg-query" and command[1] == "-S":
            return completed(command, stdout="libssl3:amd64: /usr/lib/libcrypto.so.3\n")
        if command[0] == "dpkg-query" and command[1] == "-W":
            return completed(command, stdout="libssl3:amd64 3.0.20-1\n")
        return completed(command, returncode=1)

    report_linked_libraries((42,), set(), proc_root, runner, stream)

    assert "OpenSSL=OpenSSL 3.0.20 1 Jul 2026" in stream.getvalue()
    assert "package=libssl3:amd64 3.0.20-1" in stream.getvalue()


def test_linked_library_report_deduplicates_paths_across_pids(tmp_path: Path) -> None:
    proc_root = tmp_path / "proc"
    for pid in (42, 43):
        maps_path = proc_root / str(pid) / "maps"
        maps_path.parent.mkdir(parents=True)
        maps_path.write_text(
            "7f000000-7f001000 r--p 00000000 00:00 1 /usr/lib/libssl.so.3\n",
            encoding="utf-8",
        )
    stream = StringIO()
    reported_paths: set[Path] = set()

    def runner(command: Sequence[str]) -> subprocess.CompletedProcess[str]:
        if command[0] == "strings":
            return completed(command, stdout="OpenSSL 3.0.20 1 Jul 2026\n")
        if command[0] == "dpkg-query" and command[1] == "-S":
            return completed(command, stdout="libssl3:amd64: /usr/lib/libssl.so.3\n")
        if command[0] == "dpkg-query" and command[1] == "-W":
            return completed(command, stdout="libssl3:amd64 3.0.20-1\n")
        return completed(command, returncode=1)

    report_linked_libraries((42, 43), reported_paths, proc_root, runner, stream)
    report_linked_libraries((43,), reported_paths, proc_root, runner, stream)

    assert stream.getvalue().count("Linked library PID") == 1
    assert reported_paths == {Path("/usr/lib/libssl.so.3")}


def test_openssl_and_package_lookups_report_unavailable_tools() -> None:
    def unavailable(command: Sequence[str]) -> subprocess.CompletedProcess[str]:
        raise MonitorError(MonitorErrorKind.COMMAND_NOT_FOUND, f"required command not found: {command[0]}")

    assert find_openssl_version(Path("/usr/lib/libssl.so.3"), unavailable).status is LookupStatus.UNAVAILABLE
    assert find_package_version(Path("/usr/lib/libssl.so.3"), unavailable).status is LookupStatus.UNAVAILABLE


def test_monitor_prints_only_when_memory_changes(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    tmp_path: Path,
) -> None:
    unchanged = MemorySample(pids=(42,), vmrss_kib=100, vmhwm_kib=120, rssanon_kib=80)
    changed = MemorySample(pids=(42,), vmrss_kib=110, vmhwm_kib=120, rssanon_kib=90)
    samples = iter((unchanged, unchanged, changed))

    def resolve_target(_: TargetSelector) -> tuple[int, ...]:
        return (42,)

    def sample_processes(_: Sequence[int]) -> MemorySample:
        return next(samples)

    def skip_sleep(_: float) -> None:
        return None

    monkeypatch.setattr("hollowbyte_monitor.rss_monitor.resolve_target", resolve_target)
    monkeypatch.setattr("hollowbyte_monitor.rss_monitor.sample_processes", sample_processes)
    monkeypatch.setattr("hollowbyte_monitor.rss_monitor.time.sleep", skip_sleep)

    output_path = tmp_path / "rss.tsv"
    monitor(
        MonitorConfig(
            selector=TargetSelector(SelectorKind.SERVICE, "proxy.service"),
            interval_seconds=0.1,
            refresh_seconds=60.0,
            output_path=output_path,
            sample_limit=3,
        )
    )

    captured = capsys.readouterr()
    output_lines = captured.out.splitlines()
    assert len(output_lines) == 2
    assert "RSS=100 KiB" in output_lines[0]
    assert "RSS=110 KiB" in output_lines[1]
    assert all("pid" not in line.lower() for line in output_lines)
    assert "PIDs changed from none to (42,)" in captured.err
    assert len(output_path.read_text(encoding="utf-8").splitlines()) == 3


def test_monitor_skips_an_incomplete_proc_status(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    sample = MemorySample(pids=(42,), vmrss_kib=100, vmhwm_kib=120, rssanon_kib=80)
    outcomes: list[MemorySample | MonitorError] = [
        MonitorError(MonitorErrorKind.INVALID_STATUS, "/proc/42/status is missing: vmrss_kib"),
        sample,
    ]

    def resolve_target(_: TargetSelector) -> tuple[int, ...]:
        return (42,)

    def sample_processes(_: Sequence[int]) -> MemorySample:
        outcome = outcomes.pop(0)
        if isinstance(outcome, MonitorError):
            raise outcome
        return outcome

    def skip_sleep(_: float) -> None:
        return None

    monkeypatch.setattr("hollowbyte_monitor.rss_monitor.resolve_target", resolve_target)
    monkeypatch.setattr("hollowbyte_monitor.rss_monitor.sample_processes", sample_processes)
    monkeypatch.setattr("hollowbyte_monitor.rss_monitor.time.sleep", skip_sleep)

    monitor(
        MonitorConfig(
            selector=TargetSelector(SelectorKind.SERVICE, "proxy.service"),
            interval_seconds=0.1,
            refresh_seconds=60.0,
            output_path=None,
            sample_limit=1,
        )
    )

    assert "RSS=100 KiB" in capsys.readouterr().out
