# HollowByte probe

`hollowbyte` sends the 11-byte incomplete TLS ClientHello described in the
HollowByte disclosure to an authorized test endpoint. It uses raw TCP sockets
and does not depend on OpenSSL.

The default payload is:

```text
16 03 01 00 06 01 02 01 44 03 03
```

It declares a 131,396-byte ClientHello body, supplies only its first two bytes,
and leaves the connection open for five seconds. Vulnerable OpenSSL releases
allocate the declared handshake size before waiting for the rest. Fixed
releases grow the input buffer incrementally.

Run a single low-impact probe:

```console
cargo run --release -- authorized.example --hold-seconds 5
```

The tool checks basic TCP reachability before, during, and after the probe. A
`held-open` result only confirms that the TLS listener waited for the incomplete
handshake. It cannot remotely distinguish a vulnerable build from a fixed one;
confirm that with server-side RSS measurements or the linked OpenSSL version.

See [Verifying server RSS](docs/rss-verification.md) for a complete measurement
runbook covering bare processes, systemd, Docker, and Kubernetes.

On the Linux TLS host, monitor memory live by systemd service name:

```console
./monitor_rss.py --service kanidm.service --output rss-samples.tsv
```

Or select every process that owns a TCP listening port:

```console
sudo ./monitor_rss.py --port 443 --output rss-samples.tsv
```

The monitor uses Linux procfs and has no runtime Python dependencies. Port mode
usually needs root for `ss` to disclose process IDs.

Connections and hold time are capped at 256 and 300 seconds. Only use higher
counts on systems where you have explicit authorization and server-side
monitoring.

Run the validation suite with:

```console
cargo fmt --all --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all
uv run --project . ruff format --check monitor_rss.py rss_monitor.py tests
uv run --project . ruff check monitor_rss.py rss_monitor.py tests
uv run --project . mypy --strict monitor_rss.py rss_monitor.py tests
uv run --project . pytest
```

## References

- [Okta Red Team: OpenSSL HollowByte](https://sec.okta.com/articles/2026/06/openssl-hollowbtye-a-dos-hiding-in-11-bytes/)
- [OpenSSL's analysis of the report](https://openssl-library.org/post/2026-07-21-hollowbyte/)
- [OpenSSL incremental-buffer fix](https://github.com/openssl/openssl/commit/935246a7c9334580de727b289c5eb05c71407819)
