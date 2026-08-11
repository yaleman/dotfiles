from __future__ import annotations

import subprocess
from collections.abc import Sequence
from pathlib import Path

import pytest

from hollowbyte_monitor.rss_monitor import (
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
    monitor,
    parse_proc_status,
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

    output_lines = capsys.readouterr().out.splitlines()
    assert len(output_lines) == 2
    assert "RSS=100 KiB" in output_lines[0]
    assert "RSS=110 KiB" in output_lines[1]
    assert len(output_path.read_text(encoding="utf-8").splitlines()) == 3
