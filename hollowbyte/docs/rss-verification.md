# Verifying server RSS

RSS measurement must happen on the server that terminates TLS. Measuring the
Kanidm process is useful only if Kanidm itself owns the tested listener. If port
443 belongs to a reverse proxy, load balancer, or sidecar, measure that process
or test the backend listener directly.

RSS is supporting evidence, not a version detector. A process can retain freed
heap pages in its allocator, and unrelated requests can move RSS during a test.
Use the connection result, RSS samples, and the linked TLS library together.

## 1. Identify the TLS process

On a Linux host, find the process listening on the tested port:

```console
sudo ss -ltnp '( sport = :443 )'
```

For a systemd service, obtain its main PID without relying on a process-name
match:

```console
systemctl show --property MainPID --value SERVICE_NAME
```

Confirm the PID owns the expected executable and socket:

```console
sudo readlink /proc/PID/exe
sudo ls -l /proc/PID/fd | rg 'socket:'
```

Check whether the process dynamically maps OpenSSL's TLS library:

```console
sudo rg 'libssl\.so' /proc/PID/maps
```

No match means the process may use another TLS implementation or a statically
linked library. It does not by itself prove that OpenSSL is absent.

## 2. Sample process RSS

`VmRSS` is the current resident set, `VmHWM` is its high-water mark, and
`RssAnon` isolates anonymous resident memory, which is the most relevant part
for heap allocation.

The live monitor resolves the PID again every two seconds and shows current RSS,
change from baseline, anonymous RSS, observed peak, and kernel high-water mark.
It preserves the baseline while workers are added or removed, resetting only
when every prior PID has been replaced. It prints the initial sample and then a
new line only when one of those values or the PID set changes; timestamps alone
do not produce output. PIDs appear in a separate notification only when the
process set changes, while TSV records retain the PID column.
At startup and whenever the PID set changes, it also reports mapped `libssl` or
`libcrypto` libraries, their embedded OpenSSL banner from `strings`, and the
owning Debian or RPM package version when the relevant tools are available.
Each library path is reported only once for the life of the monitor, even when
workers are added or removed.
Select a systemd service by name:

```console
 uvx --no-cache --from 'git+https://github.com/yaleman/dotfiles.git#subdirectory=hollowbyte' \
  hollowbyte-monitor --service apache2.service
```

Service mode monitors systemd's `MainPID`. If the service delegates TLS to
worker processes, use port mode so every PID reported as owning the listener is
aggregated:

```console
sudo uvx --no-cache --from 'git+https://github.com/yaleman/dotfiles.git#subdirectory=hollowbyte' \
  hollowbyte-monitor --service apache2.service --output rss-samples.tsv
```

Port mode normally requires root for `ss` to disclose process IDs. Omit
`--output` if a TSV recording is not required. The TSV also records changes
only. Press Ctrl-C to stop, or use `--samples NUMBER` for a bounded run. Sampling
defaults to 100 milliseconds and can be changed with `--interval SECONDS`.

The script is Linux-only, uses procfs, and has no runtime dependencies outside
the Python standard library. You can run it with uvx:

```shell
 uvx --no-cache --from 'git+https://github.com/yaleman/dotfiles.git#subdirectory=hollowbyte' \
  hollowbyte-monitor <extras>
```

or probably install with pip:

```shell
pip install 'git+https://github.com/yaleman/dotfiles.git#subdirectory=hollowbyte'
```

When a process exits while procfs is being read, Linux can briefly expose a
status file without memory fields. The monitor skips that incomplete sample and
continues rather than terminating.

If Python is unavailable, run this shell sampler on the server and substitute
the PID:

```sh
RSS_PID=1234
RSS_OUTPUT=rss-samples.tsv

printf 'unix_time\tvmrss_kib\tvmhwm_kib\trssanon_kib\n' | tee "$RSS_OUTPUT"
while kill -0 "$RSS_PID" 2>/dev/null; do
    RSS_TIMESTAMP=$(date +%s.%N)
    awk -v timestamp="$RSS_TIMESTAMP" '
        /^VmRSS:/ { rss = $2 }
        /^VmHWM:/ { hwm = $2 }
        /^RssAnon:/ { anon = $2 }
        END { printf "%s\t%s\t%s\t%s\n", timestamp, rss, hwm, anon }
    ' "/proc/$RSS_PID/status"
    sleep 0.1
done | tee -a "$RSS_OUTPUT"
```

Use `VmRSS` and `RssAnon` to assess recovery. `VmHWM` records the process peak
and does not decrease when memory is released.

Reading `status` is cheap enough for continuous sampling. For precise snapshots
before, during, and after the probe, also capture the process-wide rollup:

```console
sudo awk '/^(Rss|Pss|Private_Clean|Private_Dirty):/' /proc/PID/smaps_rollup
```

`smaps_rollup` walks the process mappings and is more expensive, so do not poll
it at high frequency on a busy production process.

## 3. Run a controlled comparison

Keep the RSS sampler running in one terminal. In another terminal:

1. Record at least 15 seconds of idle baseline.
2. Start with 16 connections held for 30 seconds.
3. Confirm that the CLI reports connections as `held-open`.
4. If the service remains healthy, repeat with 64 connections.
5. Continue sampling for at least 60 seconds after the connections close.

```console
cargo run --release -- AUTHORIZED_HOST --connections 16 --hold-seconds 30
cargo run --release -- AUTHORIZED_HOST --connections 64 --hold-seconds 30
```

Do not increase the count when the service becomes slow, reports failed
connections, or loses its health check. The tool caps the count at 256, but the
cap is not a claim that every server can safely handle that load.

For `internal.kanidm.yaleman.org`, the tested IPv4 and IPv6 listeners closed the
payload in roughly 26–27 milliseconds. Because no connection remained open,
there is no sustained allocation window to measure at that frontend. Server-side
sampling can still confirm that RSS remains at baseline during a small wave.

## 4. Interpret the result

| Observation | Meaning |
| --- | --- |
| Connections close immediately | The exposed listener does not exhibit the required HollowByte wait state. RSS deltas are not useful for distinguishing OpenSSL versions. |
| Connections remain open and RSS rises sharply with connection count | Consistent with per-connection handshake allocation. Compare the slope with a fixed build or inspect the linked library before calling it vulnerable. |
| Connections remain open with a much smaller RSS slope | Consistent with incremental buffer growth, but application-level allocations can obscure the expected difference. |
| RSS falls after close | The process and allocator returned or reused the pages promptly. |
| RSS remains elevated after close | Allocator high-water behavior or fragmentation is possible; this is not proof of a live allocation or memory leak. Repeat from a clean process under controlled load. |

Older OpenSSL grows the handshake buffer to the declared message size after
reading the four-byte handshake header. Fixed releases grow it incrementally,
in chunks no larger than one TLS plaintext record. Both can wait for the rest of
an incomplete ClientHello, so a held socket alone does not distinguish them.
With the default declared size, the old and fixed allocation paths differ by
roughly 112 KiB per held connection before application overhead and allocator
rounding. At 64 connections that gives a theoretical separation of about 7 MiB,
which is why the connection-count slope is more useful than one RSS snapshot.

## Containers

For Docker, obtain the host PID and use the same `/proc/PID` method:

```console
docker inspect --format '{{.State.Pid}}' CONTAINER_NAME
docker top CONTAINER_NAME -eo pid,comm,args
```

`docker stats CONTAINER_NAME` is useful as a secondary view, but it reports
container cgroup memory rather than one process's RSS and includes accounting
choices such as cache subtraction on Linux.

For Kubernetes, first identify the container that owns TLS:

```console
kubectl top pod POD_NAME --containers --namespace NAMESPACE
```

`kubectl top` is too coarse for short-lived changes because it depends on the
resource metrics pipeline. Prefer a one-second or faster `container_memory_rss`
series from the cluster's monitoring stack, or sample `/proc/PID/status` on the
node. If the TLS process is PID 1 in the container, a direct snapshot is:

```console
kubectl exec --namespace NAMESPACE POD_NAME -c CONTAINER_NAME -- awk '/^(VmRSS|VmHWM|RssAnon):/' /proc/1/status
```

## References

- [Linux kernel `/proc` documentation](https://www.kernel.org/doc/html/latest/filesystems/proc.html)
- [OpenSSL analysis of HollowByte](https://openssl-library.org/post/2026-07-21-hollowbyte/)
- [OpenSSL incremental buffer fix](https://github.com/openssl/openssl/commit/935246a7c9334580de727b289c5eb05c71407819)
- [Docker container statistics](https://docs.docker.com/reference/cli/docker/container/stats/)
- [Kubernetes resource metrics pipeline](https://kubernetes.io/docs/tasks/debug/debug-cluster/resource-metrics-pipeline/)
