#!/usr/bin/env python3

import argparse
import base64
import binascii
import json
import os
import re
import sys
from pathlib import Path
from typing import NoReturn, cast

import requests
import urllib3
from kubernetes import client, config  # type: ignore[import-untyped]
from kubernetes.client.exceptions import ApiException  # type: ignore[import-untyped]
from kubernetes.config.config_exception import ConfigException  # type: ignore[import-untyped]

LOGIN_PATH = "/data/login.json"
KEY_PATH = "/data/httpsLoadKey.json"
CERT_PATH = "/data/httpsLoadCertificate.json"
PEM_CERTIFICATE_PATTERN = re.compile(rb"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", re.DOTALL)


def die(message: str) -> NoReturn:
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(1)


def response_description(response: requests.Response) -> str:
    try:
        return json.dumps(response.json(), indent=2)
    except (requests.JSONDecodeError, ValueError):
        return response.text.strip() or "<empty response>"


def check_switch_response(response: requests.Response, operation: str) -> dict[str, object]:
    try:
        response.raise_for_status()
    except requests.HTTPError:
        die(f"{operation} returned HTTP {response.status_code}:\n{response_description(response)}")

    try:
        body = response.json()
    except (requests.JSONDecodeError, ValueError):
        die(f"{operation} returned a non-JSON response:\n{response_description(response)}")

    if not body or not isinstance(body, dict):
        die(f"{operation} returned a non-object JSON response:\n{json.dumps(body, indent=2)}")

    body = cast(dict[str, object], body)

    # The switch UI's successJudge() effectively considers:
    #
    #   success === true
    #
    # or, for some responses, absence of the success property.
    if body.get("success") is False:
        errorcode = body.get("errorcode", "<unknown>")
        die(f"{operation} failed with switch error {errorcode}:\n{json.dumps(body, indent=2)}")

    return body


def login(
    session: requests.Session,
    base_url: str,
    username: str,
    password: str,
) -> tuple[str, int]:
    url = f"{base_url}{LOGIN_PATH}"

    payload = {
        "username": username,
        "password": password,
        "operation": "write",
    }

    print(f"Logging in to {base_url}...")

    try:
        response = session.post(
            url,
            json=payload,
            timeout=60,
        )
    except requests.RequestException as exc:
        die(f"login request failed: {exc}")

    body = check_switch_response(response, "login")

    data = body.get("data")
    if not data or not isinstance(data, dict):
        die("login response does not contain a data object:\n" + json.dumps(body, indent=2))

    data = cast(dict[str, object], data)

    tid = data.get("_tid_")
    usr_lvl = data.get("usrLvl")

    if not tid:
        die("login succeeded but response contains no _tid_:\n" + json.dumps(body, indent=2))

    if usr_lvl is None:
        die("login succeeded but response contains no usrLvl:\n" + json.dumps(body, indent=2))

    try:
        parsed_usr_lvl = int(str(usr_lvl))
    except (TypeError, ValueError):
        die(f"invalid usrLvl returned by switch: {usr_lvl!r}")

    print(f"Logged in: usrLvl={parsed_usr_lvl}, _tid_={tid}")

    return str(tid), parsed_usr_lvl


def load_k8s_secret(secret_name: str, secret_namespace: str) -> tuple[bytes, bytes]:
    print(f"Loading certificate and private key from Kubernetes Secret {secret_namespace}/{secret_name}...")

    try:
        config.load_config()
    except ConfigException as exc:
        die(f"could not load Kubernetes configuration: {exc}")

    try:
        secret = client.CoreV1Api().read_namespaced_secret(name=secret_name, namespace=secret_namespace)
    except ApiException as exc:
        detail = exc.reason or f"Kubernetes API returned status {exc.status}"
        die(f"could not load Kubernetes Secret {secret_namespace}/{secret_name}: {detail}")

    data = secret.data
    if not isinstance(data, dict):
        die(f"Kubernetes Secret {secret_namespace}/{secret_name} does not contain a data object")

    data = cast(dict[str, object], data)

    decoded: dict[str, bytes] = {}
    for field in ("tls.key", "tls.crt"):
        encoded = data.get(field)
        if not isinstance(encoded, str) or not encoded:
            die(f"Kubernetes Secret {secret_namespace}/{secret_name} does not contain {field}")

        try:
            decoded[field] = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError):
            die(f"Kubernetes Secret {secret_namespace}/{secret_name} contains invalid base64 in {field}")

        if not decoded[field]:
            die(f"Kubernetes Secret {secret_namespace}/{secret_name} contains an empty {field}")

    return decoded["tls.key"], decoded["tls.crt"]


def prepare_certificate_for_switch(certificate: bytes) -> bytes:
    """the cert requires only the leaf certificate, not the CA chain.

    per https://www.tp-link.com/us/support/faq/2813/
    """
    certificates = PEM_CERTIFICATE_PATTERN.findall(certificate)
    if len(certificates) <= 1:
        return certificate

    print(
        f"warning: certificate bundle contains {len(certificates)} certificates; "
        "the switch supports only the leaf certificate, so the CA chain will be omitted",
        file=sys.stderr,
    )
    return certificates[0] + b"\n"


def upload_data(
    session: requests.Session,
    base_url: str,
    endpoint: str,
    filename: str,
    content: bytes,
    tid: str,
    usr_lvl: int,
    description: str,
    tolerate_disconnect: bool = False,
) -> None:
    url = f"{base_url}{endpoint}"

    params: dict[str, str | int] = {
        "usrLvl": usr_lvl,
        "_tid_": tid,
    }

    print(f"Uploading {description}: {filename}")

    try:
        # The HAR explicitly shows name="file" for the certificate
        # upload. The firmware uses the same generic iframe/form
        # upload mechanism for both endpoints.
        files = {
            "file": (
                filename,
                content,
                "application/octet-stream",
            )
        }

        response = session.post(
            url,
            params=params,
            files=files,
            timeout=120,
        )

    except requests.ConnectionError as exc:
        if tolerate_disconnect:
            print(
                f"warning: connection disappeared while uploading {description}: {exc}",
                file=sys.stderr,
            )
            print(
                "The HAR does the same thing for the certificate upload; "
                "the switch may be restarting HTTPS after installing it.",
                file=sys.stderr,
            )
            return

        die(f"{description} upload connection failed: {exc}")

    except requests.RequestException as exc:
        die(f"{description} upload failed: {exc}")

    body = check_switch_response(response, f"{description} upload")

    print(f"{description} uploaded successfully" + (f": {json.dumps(body, separators=(',', ':'))}" if body else ""))


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload an HTTPS private key and certificate to an Omada switch.")

    parser.add_argument(
        "key",
        type=Path,
        nargs="?",
        help="private key file, e.g. privkey.pem; omit when using a Kubernetes Secret",
    )
    parser.add_argument(
        "certificate",
        type=Path,
        nargs="?",
        help="certificate file, e.g. fullchain.pem; omit when using a Kubernetes Secret",
    )
    parser.add_argument(
        "--k8s-secret-name",
        default=os.environ.get("OMADA_K8S_SECRET_NAME"),
        help="Kubernetes TLS Secret name (default: $OMADA_K8S_SECRET_NAME)",
    )
    parser.add_argument(
        "--k8s-secret-namespace",
        default=os.environ.get("OMADA_K8S_SECRET_NAMESPACE"),
        help="Kubernetes TLS Secret namespace (default: $OMADA_K8S_SECRET_NAMESPACE)",
    )
    parser.add_argument(
        "--url",
        default=os.environ.get("OMADA_URL"),
        help=("switch base URL (default: $OMADA_URL)"),
    )

    args = parser.parse_args()

    username = os.environ.get("OMADA_USERNAME")
    password = os.environ.get("OMADA_PASSWORD")

    if not username:
        die("OMADA_USERNAME environment variable is not set")

    if not password:
        die("OMADA_PASSWORD environment variable is not set")

    if not args.url:
        parser.error("--url or OMADA_URL environment variable is required")

    using_files = args.key is not None or args.certificate is not None
    using_k8s = args.k8s_secret_name is not None or args.k8s_secret_namespace is not None

    if using_files and using_k8s:
        parser.error("provide either key and certificate files or a Kubernetes Secret, not both")

    if using_k8s:
        if not args.k8s_secret_name or not args.k8s_secret_namespace:
            parser.error("--k8s-secret-name and --k8s-secret-namespace must be provided together")

        key_content, certificate_content = load_k8s_secret(args.k8s_secret_name, args.k8s_secret_namespace)
        key_filename = "tls.key"
        certificate_filename = "tls.crt"
    else:
        if args.key is None or args.certificate is None:
            parser.error("provide both key and certificate files, or use the Kubernetes Secret options")

        key = args.key.expanduser().resolve()
        certificate = args.certificate.expanduser().resolve()

        if not key.is_file():
            die(f"private key does not exist: {key}")

        if not certificate.is_file():
            die(f"certificate does not exist: {certificate}")

        key_content = key.read_bytes()
        certificate_content = certificate.read_bytes()
        key_filename = key.name
        certificate_filename = certificate.name

    certificate_content = prepare_certificate_for_switch(certificate_content)

    base_url = args.url.rstrip("/")

    # Yes, deliberately disable certificate validation. This is intended
    # for talking to the switch while it has its factory/self-signed cert.
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    session = requests.Session()
    session.verify = False

    # Probably unnecessary, but these make us look somewhat like the
    # browser requests from the HAR without copying all the Sec-Fetch crap.
    session.headers.update(
        {
            "Accept": "application/json, text/plain, */*",
            "Origin": base_url,
            "Referer": f"{base_url}/",
            "User-Agent": "omada-certificate-uploader/1.0",
        }
    )

    tid, usr_lvl = login(
        session=session,
        base_url=base_url,
        username=username,
        password=password,
    )

    # This is the order seen in the HAR.
    upload_data(
        session=session,
        base_url=base_url,
        endpoint=KEY_PATH,
        filename=key_filename,
        content=key_content,
        tid=tid,
        usr_lvl=usr_lvl,
        description="private key",
    )

    upload_data(
        session=session,
        base_url=base_url,
        endpoint=CERT_PATH,
        filename=certificate_filename,
        content=certificate_content,
        tid=tid,
        usr_lvl=usr_lvl,
        description="certificate",
        tolerate_disconnect=True,
    )


if __name__ == "__main__":
    main()
