from __future__ import annotations

import time
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Protocol

from cryptography import x509

from omada_certificate_updater.certificates import fingerprint, validate_tls_material
from omada_certificate_updater.models import Settings, TlsMaterial, UpdateResult


class Store(Protocol):
    def read_tls_material(self, namespace: str, secret_name: str) -> TlsMaterial: ...


class Renewer(Protocol):
    def renew(self, namespace: str, certificate_name: str) -> None: ...


class Switch(Protocol):
    def fetch_certificate(self, timeout_seconds: float = 30) -> x509.Certificate: ...

    def upload(self, material: TlsMaterial) -> None: ...


class RenewalTimeoutError(RuntimeError):
    """cert-manager did not update the TLS Secret in time."""


class VerificationTimeoutError(RuntimeError):
    """The switch did not begin serving the expected certificate in time."""


class CertificateUpdater:
    def __init__(
        self,
        store: Store,
        renewer: Renewer,
        switch: Switch,
        *,
        now: Callable[[], datetime] | None = None,
        monotonic: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
        poll_interval_seconds: float = 10,
        verification_timeout_seconds: float = 120,
    ) -> None:
        self._store = store
        self._renewer = renewer
        self._switch = switch
        self._now = now or (lambda: datetime.now(UTC))
        self._monotonic = monotonic
        self._sleep = sleep
        self._poll_interval_seconds = poll_interval_seconds
        self._verification_timeout_seconds = verification_timeout_seconds

    def run(self, settings: Settings) -> UpdateResult:
        now = self._now()
        material = self._store.read_tls_material(settings.namespace, settings.secret_name)
        secret_certificate = validate_tls_material(material, now)
        switch_certificate = self._switch.fetch_certificate()

        secret_fingerprint = fingerprint(secret_certificate)
        switch_fingerprint = fingerprint(switch_certificate)
        expires_within = now + timedelta(days=settings.expiry_threshold_days)

        if secret_fingerprint == switch_fingerprint and switch_certificate.not_valid_after_utc > expires_within:
            print("Switch certificate matches the Kubernetes Secret and is not near expiry")
            return UpdateResult.CURRENT

        if secret_fingerprint == switch_fingerprint:
            print("Switch certificate is near expiry and the Kubernetes Secret has not changed")
            self._renewer.renew(settings.namespace, settings.certificate_name)
            material, secret_certificate = self._wait_for_renewal(
                settings,
                previous_fingerprint=secret_fingerprint,
            )
            secret_fingerprint = fingerprint(secret_certificate)
        else:
            print("Kubernetes Secret contains a certificate not currently served by the switch")

        self._switch.upload(material)
        self._wait_for_switch(secret_fingerprint)
        print("Switch is serving the certificate from the Kubernetes Secret")
        return UpdateResult.UPDATED

    def _wait_for_renewal(
        self,
        settings: Settings,
        previous_fingerprint: str,
    ) -> tuple[TlsMaterial, x509.Certificate]:
        deadline = self._monotonic() + settings.renewal_timeout_seconds
        while self._monotonic() < deadline:
            self._sleep(self._poll_interval_seconds)
            material = self._store.read_tls_material(settings.namespace, settings.secret_name)
            certificate = validate_tls_material(material, self._now())
            if fingerprint(certificate) != previous_fingerprint:
                return material, certificate
        raise RenewalTimeoutError(
            f"Certificate {settings.namespace}/{settings.certificate_name} did not renew within "
            f"{settings.renewal_timeout_seconds} seconds"
        )

    def _wait_for_switch(self, expected_fingerprint: str) -> None:
        deadline = self._monotonic() + self._verification_timeout_seconds
        last_error: Exception | None = None
        while self._monotonic() < deadline:
            self._sleep(self._poll_interval_seconds)
            try:
                served = self._switch.fetch_certificate()
            except RuntimeError as exc:
                last_error = exc
                continue
            if fingerprint(served) == expected_fingerprint:
                return
        detail = f": {last_error}" if last_error else ""
        raise VerificationTimeoutError(f"switch did not serve the uploaded certificate in time{detail}")
