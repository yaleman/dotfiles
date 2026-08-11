"""Linux process RSS monitoring for the HollowByte probe."""

from __future__ import annotations

import argparse
import math
import re
import subprocess
import sys
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import IO


class MonitorErrorKind(Enum):
    """Machine-readable monitor failure categories."""

    COMMAND_NOT_FOUND = "command-not-found"
    COMMAND_FAILED = "command-failed"
    TARGET_NOT_FOUND = "target-not-found"
    PID_UNAVAILABLE = "pid-unavailable"
    PROCESS_GONE = "process-gone"
    INVALID_STATUS = "invalid-status"
    OUTPUT_FAILED = "output-failed"


class MonitorError(Exception):
    """A monitoring failure with a stable kind and human-readable detail."""

    def __init__(self, kind: MonitorErrorKind, detail: str) -> None:
        super().__init__(detail)
        self.kind = kind
        self.detail = detail

    def __str__(self) -> str:
        return self.detail


class SelectorKind(Enum):
    """Supported ways to locate the monitored process set."""

    SERVICE = "service"
    PORT = "port"


class LookupStatus(Enum):
    """Result state for non-essential linked-library inspection."""

    FOUND = "found"
    NOT_FOUND = "not-found"
    UNAVAILABLE = "unavailable"


@dataclass(frozen=True)
class TargetSelector:
    """A systemd service or TCP listening port selector."""

    kind: SelectorKind
    value: str

    @property
    def description(self) -> str:
        return f"{self.kind.value} {self.value}"


@dataclass(frozen=True)
class ProcessMemory:
    """Relevant values from one process's procfs status file, in KiB."""

    pid: int
    vmrss_kib: int
    vmhwm_kib: int
    rssanon_kib: int


@dataclass(frozen=True)
class MemorySample:
    """Aggregate memory for every process selected by the target."""

    pids: tuple[int, ...]
    vmrss_kib: int
    vmhwm_kib: int
    rssanon_kib: int


@dataclass(frozen=True)
class MonitorConfig:
    """Runtime settings for live sampling."""

    selector: TargetSelector
    interval_seconds: float
    refresh_seconds: float
    output_path: Path | None
    sample_limit: int | None


@dataclass(frozen=True)
class LookupResult:
    """A value discovered by an optional host inspection command."""

    status: LookupStatus
    value: str | None = None


CommandRunner = Callable[[Sequence[str]], subprocess.CompletedProcess[str]]

_PID_PATTERN = re.compile(r"\bpid=(\d+)\b")
_LIBRARY_NAME_PATTERN = re.compile(r"^lib(?:ssl|crypto)\.so(?:\..+)?$")
_OPENSSL_VERSION_PATTERN = re.compile(r"^OpenSSL\s+.+$")
_STATUS_FIELDS = {
    "VmRSS": "vmrss_kib",
    "VmHWM": "vmhwm_kib",
    "RssAnon": "rssanon_kib",
}


def run_command(command: Sequence[str]) -> subprocess.CompletedProcess[str]:
    """Run a read-only system command without invoking a shell."""

    try:
        return subprocess.run(command, capture_output=True, text=True, check=False)
    except FileNotFoundError as error:
        raise MonitorError(
            MonitorErrorKind.COMMAND_NOT_FOUND,
            f"required command not found: {command[0]}",
        ) from error


def resolve_service_pids(service: str, runner: CommandRunner = run_command) -> tuple[int, ...]:
    """Resolve a systemd service's current MainPID."""

    result = runner(("systemctl", "show", "--property", "MainPID", "--value", service))
    if result.returncode != 0:
        detail = result.stderr.strip() or "systemctl did not return a MainPID"
        raise MonitorError(MonitorErrorKind.COMMAND_FAILED, f"could not inspect {service}: {detail}")

    value = result.stdout.strip()
    try:
        pid = int(value)
    except ValueError as error:
        raise MonitorError(
            MonitorErrorKind.PID_UNAVAILABLE,
            f"systemd returned an invalid MainPID for {service}: {value!r}",
        ) from error

    if pid <= 0:
        raise MonitorError(
            MonitorErrorKind.TARGET_NOT_FOUND,
            f"service {service} has no running MainPID",
        )
    return (pid,)


def resolve_port_pids(port: int, runner: CommandRunner = run_command) -> tuple[int, ...]:
    """Resolve every process reported as owning a TCP listening port."""

    result = runner(("ss", "-H", "-ltnp", f"sport = :{port}"))
    if result.returncode != 0:
        detail = result.stderr.strip() or "ss failed without an error message"
        raise MonitorError(MonitorErrorKind.COMMAND_FAILED, f"could not inspect TCP port {port}: {detail}")

    pids = tuple(sorted({int(match) for match in _PID_PATTERN.findall(result.stdout)}))
    if pids:
        return pids
    if result.stdout.strip():
        raise MonitorError(
            MonitorErrorKind.PID_UNAVAILABLE,
            f"TCP port {port} is listening, but ss did not expose its PID; run the monitor as root",
        )
    raise MonitorError(MonitorErrorKind.TARGET_NOT_FOUND, f"nothing is listening on TCP port {port}")


def resolve_target(selector: TargetSelector, runner: CommandRunner = run_command) -> tuple[int, ...]:
    """Resolve a selector to its current process set."""

    if selector.kind is SelectorKind.SERVICE:
        return resolve_service_pids(selector.value, runner)
    return resolve_port_pids(int(selector.value), runner)


def parse_proc_status(pid: int, contents: str) -> ProcessMemory:
    """Parse required memory fields from /proc/PID/status."""

    values: dict[str, int] = {}
    for line in contents.splitlines():
        name, separator, remainder = line.partition(":")
        field = _STATUS_FIELDS.get(name)
        if field is None or not separator:
            continue
        parts = remainder.split()
        if len(parts) != 2 or parts[1] != "kB":
            raise MonitorError(
                MonitorErrorKind.INVALID_STATUS,
                f"unexpected {name} value for PID {pid}: {remainder.strip()!r}",
            )
        try:
            values[field] = int(parts[0])
        except ValueError as error:
            raise MonitorError(
                MonitorErrorKind.INVALID_STATUS,
                f"non-numeric {name} value for PID {pid}: {parts[0]!r}",
            ) from error

    missing = sorted(set(_STATUS_FIELDS.values()) - values.keys())
    if missing:
        raise MonitorError(
            MonitorErrorKind.INVALID_STATUS,
            f"/proc/{pid}/status is missing: {', '.join(missing)}",
        )
    return ProcessMemory(
        pid=pid,
        vmrss_kib=values["vmrss_kib"],
        vmhwm_kib=values["vmhwm_kib"],
        rssanon_kib=values["rssanon_kib"],
    )


def read_process_memory(pid: int, proc_root: Path = Path("/proc")) -> ProcessMemory:
    """Read one process's current memory counters from procfs."""

    status_path = proc_root / str(pid) / "status"
    try:
        contents = status_path.read_text(encoding="utf-8")
    except FileNotFoundError as error:
        raise MonitorError(MonitorErrorKind.PROCESS_GONE, f"PID {pid} exited") from error
    except PermissionError as error:
        raise MonitorError(
            MonitorErrorKind.PID_UNAVAILABLE,
            f"permission denied reading {status_path}",
        ) from error
    except OSError as error:
        raise MonitorError(
            MonitorErrorKind.INVALID_STATUS,
            f"could not read {status_path}: {error}",
        ) from error
    return parse_proc_status(pid, contents)


def aggregate_process_memory(processes: Sequence[ProcessMemory]) -> MemorySample:
    """Sum memory counters for a non-empty process set."""

    if not processes:
        raise MonitorError(MonitorErrorKind.TARGET_NOT_FOUND, "no processes were available to sample")
    return MemorySample(
        pids=tuple(sorted(process.pid for process in processes)),
        vmrss_kib=sum(process.vmrss_kib for process in processes),
        vmhwm_kib=sum(process.vmhwm_kib for process in processes),
        rssanon_kib=sum(process.rssanon_kib for process in processes),
    )


def sample_processes(pids: Sequence[int], proc_root: Path = Path("/proc")) -> MemorySample:
    """Read and aggregate a stable process set."""

    return aggregate_process_memory([read_process_memory(pid, proc_root) for pid in pids])


def read_loaded_library_paths(pid: int, proc_root: Path = Path("/proc")) -> tuple[Path, ...]:
    """Read libssl and libcrypto paths actually mapped by a process."""

    maps_path = proc_root / str(pid) / "maps"
    try:
        contents = maps_path.read_text(encoding="utf-8")
    except FileNotFoundError as error:
        raise MonitorError(MonitorErrorKind.PROCESS_GONE, f"PID {pid} exited") from error
    except PermissionError as error:
        raise MonitorError(
            MonitorErrorKind.PID_UNAVAILABLE,
            f"permission denied reading {maps_path}",
        ) from error
    except OSError as error:
        raise MonitorError(
            MonitorErrorKind.PID_UNAVAILABLE,
            f"could not read {maps_path}: {error}",
        ) from error

    paths: set[Path] = set()
    for line in contents.splitlines():
        fields = line.split(maxsplit=5)
        if len(fields) != 6:
            continue
        mapped_path = fields[5].removesuffix(" (deleted)")
        if mapped_path.startswith("/") and _LIBRARY_NAME_PATTERN.match(Path(mapped_path).name):
            paths.add(Path(mapped_path))
    return tuple(sorted(paths))


def _run_optional(command: Sequence[str], runner: CommandRunner) -> LookupResult:
    """Run an optional command without converting an unavailable tool into a monitor failure."""

    try:
        result = runner(command)
    except MonitorError as error:
        if error.kind is MonitorErrorKind.COMMAND_NOT_FOUND:
            return LookupResult(LookupStatus.UNAVAILABLE)
        return LookupResult(LookupStatus.UNAVAILABLE)
    if result.returncode != 0:
        return LookupResult(LookupStatus.NOT_FOUND)
    return LookupResult(LookupStatus.FOUND, result.stdout)


def find_openssl_version(library_path: Path, runner: CommandRunner = run_command) -> LookupResult:
    """Extract the OpenSSL banner embedded in a loaded library, when available."""

    output = _run_optional(("strings", "-a", str(library_path)), runner)
    if output.status is not LookupStatus.FOUND or output.value is None:
        return output
    for line in output.value.splitlines():
        if _OPENSSL_VERSION_PATTERN.match(line):
            return LookupResult(LookupStatus.FOUND, line)
    return LookupResult(LookupStatus.NOT_FOUND)


def find_package_version(library_path: Path, runner: CommandRunner = run_command) -> LookupResult:
    """Find the owning Debian or RPM package for a mapped library path."""

    package_tools_available = False
    dpkg_owner = _run_optional(("dpkg-query", "-S", "--", str(library_path)), runner)
    if dpkg_owner.status is not LookupStatus.UNAVAILABLE:
        package_tools_available = True
        if dpkg_owner.status is LookupStatus.FOUND and dpkg_owner.value is not None:
            package_name, separator, _ = dpkg_owner.value.strip().partition(": ")
            if separator:
                version = _run_optional(
                    ("dpkg-query", "-W", "-f=${Package} ${Version}\\n", package_name),
                    runner,
                )
                if version.status is LookupStatus.FOUND and version.value is not None:
                    return LookupResult(LookupStatus.FOUND, version.value.strip())
                return LookupResult(LookupStatus.FOUND, package_name)

    rpm_package = _run_optional(
        ("rpm", "-qf", "--qf", "%{NAME} %{VERSION}-%{RELEASE}\\n", str(library_path)),
        runner,
    )
    if rpm_package.status is not LookupStatus.UNAVAILABLE:
        package_tools_available = True
        if rpm_package.status is LookupStatus.FOUND and rpm_package.value is not None:
            return LookupResult(LookupStatus.FOUND, rpm_package.value.strip())

    if package_tools_available:
        return LookupResult(LookupStatus.NOT_FOUND)
    return LookupResult(LookupStatus.UNAVAILABLE)


def report_linked_libraries(
    pids: Sequence[int],
    proc_root: Path = Path("/proc"),
    runner: CommandRunner = run_command,
    output: IO[str] | None = None,
) -> None:
    """Print non-fatal OpenSSL linked-library diagnostics for the current PID set."""

    stream = output if output is not None else sys.stderr
    libraries: list[tuple[int, Path]] = []
    for pid in pids:
        try:
            mapped_paths = read_loaded_library_paths(pid, proc_root)
        except MonitorError as error:
            print(f"Linked libraries for PID {pid}: unavailable ({error.kind.value})", file=stream)
            continue
        libraries.extend((pid, path) for path in mapped_paths)

    if not libraries:
        print("Linked OpenSSL libraries: none found or inaccessible", file=stream)
        return

    for pid, library_path in libraries:
        process_path = proc_root / str(pid) / "root" / library_path.relative_to("/")
        version = find_openssl_version(process_path, runner)
        package = find_package_version(library_path, runner)
        version_text = version.value if version.status is LookupStatus.FOUND else version.status.value
        package_text = package.value if package.status is LookupStatus.FOUND else package.status.value
        print(
            f"Linked library PID {pid}: {library_path}; OpenSSL={version_text}; package={package_text}",
            file=stream,
        )


def format_kib(value: int, *, signed: bool = False) -> str:
    """Format KiB as a compact human-readable value."""

    sign = "+" if signed and value >= 0 else ""
    if abs(value) >= 1024:
        return f"{sign}{value / 1024:.1f} MiB"
    return f"{sign}{value} KiB"


def render_sample(
    selector: TargetSelector,
    sample: MemorySample,
    baseline: MemorySample,
    observed_peak_kib: int,
) -> str:
    """Render one live terminal status line."""

    return (
        f"{datetime.now().astimezone().isoformat(timespec='seconds')}  "
        f"{selector.description}  "
        f"RSS={format_kib(sample.vmrss_kib)} "
        f"delta={format_kib(sample.vmrss_kib - baseline.vmrss_kib, signed=True)}  "
        f"Anon={format_kib(sample.rssanon_kib)} "
        f"delta={format_kib(sample.rssanon_kib - baseline.rssanon_kib, signed=True)}  "
        f"peak={format_kib(observed_peak_kib)}  HWM={format_kib(sample.vmhwm_kib)}"
    )


def _open_output(path: Path | None) -> IO[str] | None:
    if path is None:
        return None
    try:
        output = path.open("w", encoding="utf-8", buffering=1)
    except OSError as error:
        raise MonitorError(MonitorErrorKind.OUTPUT_FAILED, f"could not open {path}: {error}") from error
    output.write("unix_time\tpids\tvmrss_kib\trss_delta_kib\tvmhwm_kib\trssanon_kib\trssanon_delta_kib\n")
    return output


def _write_tsv(output: IO[str], sample: MemorySample, baseline: MemorySample) -> None:
    output.write(
        f"{time.time():.6f}\t{','.join(str(pid) for pid in sample.pids)}\t"
        f"{sample.vmrss_kib}\t{sample.vmrss_kib - baseline.vmrss_kib}\t"
        f"{sample.vmhwm_kib}\t{sample.rssanon_kib}\t"
        f"{sample.rssanon_kib - baseline.rssanon_kib}\n"
    )


def monitor(config: MonitorConfig) -> None:
    """Continuously resolve and sample a target until interrupted or limited."""

    output = _open_output(config.output_path)
    pids: tuple[int, ...] = ()
    baseline: MemorySample | None = None
    previous_sample: MemorySample | None = None
    observed_peak_kib = 0
    completed_samples = 0
    next_refresh = 0.0

    try:
        while config.sample_limit is None or completed_samples < config.sample_limit:
            now = time.monotonic()
            if not pids or now >= next_refresh:
                resolved = resolve_target(config.selector)
                next_refresh = now + config.refresh_seconds
                if resolved != pids:
                    print(
                        f"Monitoring {config.selector.description}; PIDs changed from "
                        f"{pids or 'none'} to {resolved}; baseline reset.",
                        file=sys.stderr,
                    )
                    pids = resolved
                    baseline = None
                    previous_sample = None
                    observed_peak_kib = 0
                    report_linked_libraries(pids)

            try:
                sample = sample_processes(pids)
            except MonitorError as error:
                if error.kind is MonitorErrorKind.PROCESS_GONE:
                    pids = ()
                    baseline = None
                    previous_sample = None
                elif error.kind is not MonitorErrorKind.INVALID_STATUS:
                    raise
                time.sleep(config.interval_seconds)
                continue

            if baseline is None:
                baseline = sample
            observed_peak_kib = max(observed_peak_kib, sample.vmrss_kib)
            if sample != previous_sample:
                print(render_sample(config.selector, sample, baseline, observed_peak_kib), flush=True)
                if output is not None:
                    _write_tsv(output, sample, baseline)
                previous_sample = sample

            completed_samples += 1
            if config.sample_limit is None or completed_samples < config.sample_limit:
                time.sleep(config.interval_seconds)
    finally:
        if output is not None:
            output.close()


def _port(value: str) -> int:
    try:
        port = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("port must be an integer") from error
    if not 1 <= port <= 65535:
        raise argparse.ArgumentTypeError("port must be between 1 and 65535")
    return port


def _positive_float(value: str) -> float:
    try:
        parsed = float(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("value must be a number") from error
    if not math.isfinite(parsed) or parsed <= 0:
        raise argparse.ArgumentTypeError("value must be a finite number greater than zero")
    return parsed


def _positive_int(value: str) -> int:
    try:
        parsed = int(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("value must be an integer") from error
    if parsed <= 0:
        raise argparse.ArgumentTypeError("value must be greater than zero")
    return parsed


def build_parser() -> argparse.ArgumentParser:
    """Build the command-line interface."""

    parser = argparse.ArgumentParser(
        description="Monitor Linux process RSS live using a systemd service or TCP listening port.",
    )
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--service", metavar="NAME", help="systemd service name")
    target.add_argument("--port", metavar="PORT", type=_port, help="TCP listening port")
    parser.add_argument(
        "--interval", type=_positive_float, default=0.1, help="sample interval in seconds (default: 0.1)"
    )
    parser.add_argument(
        "--refresh-seconds",
        type=_positive_float,
        default=2.0,
        help="PID re-resolution interval (default: 2.0)",
    )
    parser.add_argument("--output", type=Path, help="write samples to a TSV file")
    parser.add_argument("--samples", type=_positive_int, help="stop after this many samples")
    return parser


def config_from_args(arguments: argparse.Namespace) -> MonitorConfig:
    """Convert validated argparse output into typed monitor configuration."""

    if arguments.service is not None:
        selector = TargetSelector(SelectorKind.SERVICE, str(arguments.service))
    else:
        selector = TargetSelector(SelectorKind.PORT, str(arguments.port))
    return MonitorConfig(
        selector=selector,
        interval_seconds=float(arguments.interval),
        refresh_seconds=float(arguments.refresh_seconds),
        output_path=arguments.output,
        sample_limit=arguments.samples,
    )


def run_cli(argv: Sequence[str] | None = None) -> int:
    """Run the CLI and convert typed failures to exit statuses."""

    config = config_from_args(build_parser().parse_args(argv))
    try:
        monitor(config)
    except KeyboardInterrupt:
        return 130
    except MonitorError as error:
        print(f"error [{error.kind.value}]: {error}", file=sys.stderr)
        return 1
    return 0
