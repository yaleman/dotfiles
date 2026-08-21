#!/usr/bin/env python3

import argparse
import json
import os
import sys
from pathlib import Path

import requests
import urllib3

LOGIN_PATH = "/data/login.json"
KEY_PATH = "/data/httpsLoadKey.json"
CERT_PATH = "/data/httpsLoadCertificate.json"


def die(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(1)


def response_description(response: requests.Response) -> str:
    try:
        return json.dumps(response.json(), indent=2)
    except (requests.JSONDecodeError, ValueError):
        return response.text.strip() or "<empty response>"


def check_switch_response(response: requests.Response, operation: str) -> dict:
    try:
        response.raise_for_status()
    except requests.HTTPError:
        die(f"{operation} returned HTTP {response.status_code}:\n{response_description(response)}")

    try:
        body = response.json()
    except (requests.JSONDecodeError, ValueError):
        die(f"{operation} returned a non-JSON response:\n{response_description(response)}")

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
        raise ValueError("login response does not contain a data object:\n" + json.dumps(body, indent=2))

    tid = data.get("_tid_")
    usr_lvl = data.get("usrLvl")

    if not tid:
        die("login succeeded but response contains no _tid_:\n" + json.dumps(body, indent=2))

    if usr_lvl is None:
        die("login succeeded but response contains no usrLvl:\n" + json.dumps(body, indent=2))

    try:
        usr_lvl = int(usr_lvl)
    except (TypeError, ValueError):
        die(f"invalid usrLvl returned by switch: {usr_lvl!r}")

    print(f"Logged in: usrLvl={usr_lvl}, _tid_={tid}")

    return str(tid), usr_lvl


def upload_file(
    session: requests.Session,
    base_url: str,
    endpoint: str,
    path: Path,
    tid: str,
    usr_lvl: int,
    description: str,
    tolerate_disconnect: bool = False,
) -> None:
    url = f"{base_url}{endpoint}"

    params = {
        "usrLvl": usr_lvl,
        "_tid_": tid,
    }

    print(f"Uploading {description}: {path}")

    try:
        with path.open("rb") as fp:
            # The HAR explicitly shows name="file" for the certificate
            # upload. The firmware uses the same generic iframe/form
            # upload mechanism for both endpoints.
            files = {
                "file": (
                    path.name,
                    fp,
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
        help="private key file, e.g. privkey.pem",
    )
    parser.add_argument(
        "certificate",
        type=Path,
        help="certificate file, e.g. fullchain.pem",
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
        raise ValueError("OMADA_USERNAME is not set")

    if not password:
        raise ValueError("OMADA_PASSWORD is not set")

    key = args.key.expanduser().resolve()
    certificate = args.certificate.expanduser().resolve()

    if not key.is_file():
        die(f"private key does not exist: {key}")

    if not certificate.is_file():
        die(f"certificate does not exist: {certificate}")

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
    upload_file(
        session=session,
        base_url=base_url,
        endpoint=KEY_PATH,
        path=key,
        tid=tid,
        usr_lvl=usr_lvl,
        description="private key",
    )

    upload_file(
        session=session,
        base_url=base_url,
        endpoint=CERT_PATH,
        path=certificate,
        tid=tid,
        usr_lvl=usr_lvl,
        description="certificate",
        # Chrome recorded status 0 for this request. Very plausible that
        # replacing the HTTPS certificate drops the HTTP connection.
        tolerate_disconnect=True,
    )


if __name__ == "__main__":
    main()
