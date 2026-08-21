from __future__ import annotations

import json
import socket
import ssl
from typing import Any, cast
from urllib.parse import urlparse

import requests
import urllib3
from cryptography import x509

from omada_certificate_updater.certificates import leaf_certificate_pem
from omada_certificate_updater.models import TlsMaterial

LOGIN_PATH = "/data/login.json"
KEY_PATH = "/data/httpsLoadKey.json"
CERT_PATH = "/data/httpsLoadCertificate.json"


class SwitchError(RuntimeError):
    """The switch could not be inspected or updated."""


class OmadaSwitch:
    def __init__(self, base_url: str, username: str, password: str) -> None:
        parsed = urlparse(base_url)
        if parsed.scheme != "https" or not parsed.hostname:
            raise SwitchError("OMADA_URL must be an HTTPS URL with a hostname")
        self._base_url = base_url.rstrip("/")
        self._hostname = parsed.hostname
        self._port = parsed.port or 443
        self._username = username
        self._password = password

    def fetch_certificate(self, timeout_seconds: float = 30) -> x509.Certificate:
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        try:
            with (
                socket.create_connection((self._hostname, self._port), timeout=timeout_seconds) as connection,
                context.wrap_socket(connection, server_hostname=self._hostname) as tls_connection,
            ):
                certificate = tls_connection.getpeercert(binary_form=True)
        except (OSError, ssl.SSLError) as exc:
            raise SwitchError(f"could not read the switch TLS certificate: {exc}") from exc
        if not certificate:
            raise SwitchError("the switch returned no TLS certificate")
        try:
            return x509.load_der_x509_certificate(certificate)
        except ValueError as exc:
            raise SwitchError("the switch returned an invalid TLS certificate") from exc

    def upload(self, material: TlsMaterial) -> None:
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        session = requests.Session()
        session.verify = False
        session.headers.update(
            {
                "Accept": "application/json, text/plain, */*",
                "Origin": self._base_url,
                "Referer": f"{self._base_url}/",
                "User-Agent": "omada-certificate-uploader/1.0",
            }
        )
        tid, user_level = self._login(session)
        self._upload_data(
            session,
            KEY_PATH,
            "tls.key",
            material.private_key,
            tid,
            user_level,
            "private key",
        )
        self._upload_data(
            session,
            CERT_PATH,
            "tls.crt",
            leaf_certificate_pem(material.certificate),
            tid,
            user_level,
            "certificate",
            tolerate_disconnect=True,
        )

    def _login(self, session: requests.Session) -> tuple[str, int]:
        try:
            response = session.post(
                f"{self._base_url}{LOGIN_PATH}",
                json={"username": self._username, "password": self._password, "operation": "write"},
                timeout=60,
            )
        except requests.RequestException as exc:
            raise SwitchError(f"login request failed: {exc}") from exc

        body = self._check_response(response, "login")
        data = body.get("data")
        if not isinstance(data, dict):
            raise SwitchError("login response does not contain a data object")
        tid = data.get("_tid_")
        user_level = data.get("usrLvl")
        if not tid or user_level is None:
            raise SwitchError("login response is missing session information")
        try:
            parsed_user_level = int(str(user_level))
        except (TypeError, ValueError) as exc:
            raise SwitchError("login response contains an invalid usrLvl") from exc
        print(f"Logged in to {self._base_url} with usrLvl={parsed_user_level}")
        return str(tid), parsed_user_level

    def _upload_data(
        self,
        session: requests.Session,
        endpoint: str,
        filename: str,
        content: bytes,
        tid: str,
        user_level: int,
        description: str,
        *,
        tolerate_disconnect: bool = False,
    ) -> None:
        print(f"Uploading {description}")
        try:
            response = session.post(
                f"{self._base_url}{endpoint}",
                params={"usrLvl": user_level, "_tid_": tid},
                files={"file": (filename, content, "application/octet-stream")},
                timeout=120,
            )
        except requests.ConnectionError as exc:
            if tolerate_disconnect:
                print(f"Switch disconnected while installing the certificate: {exc}")
                return
            raise SwitchError(f"{description} upload connection failed: {exc}") from exc
        except requests.RequestException as exc:
            raise SwitchError(f"{description} upload failed: {exc}") from exc
        self._check_response(response, f"{description} upload")

    @staticmethod
    def _response_description(response: requests.Response) -> str:
        try:
            return json.dumps(response.json(), indent=2)
        except (requests.JSONDecodeError, ValueError):
            return response.text.strip() or "<empty response>"

    @classmethod
    def _check_response(cls, response: requests.Response, operation: str) -> dict[str, Any]:
        try:
            response.raise_for_status()
        except requests.HTTPError as exc:
            raise SwitchError(
                f"{operation} returned HTTP {response.status_code}: {cls._response_description(response)}"
            ) from exc
        try:
            body = response.json()
        except (requests.JSONDecodeError, ValueError) as exc:
            raise SwitchError(f"{operation} returned a non-JSON response") from exc
        if not isinstance(body, dict) or not body:
            raise SwitchError(f"{operation} returned a non-object JSON response")
        body = cast(dict[str, Any], body)
        if body.get("success") is False:
            raise SwitchError(f"{operation} failed with switch error {body.get('errorcode', '<unknown>')}")
        return body
