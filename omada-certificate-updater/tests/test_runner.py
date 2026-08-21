from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

from omada_certificate_updater.certificates import (
    CertificateError,
    load_leaf_certificate,
)
from omada_certificate_updater.models import Settings, TlsMaterial, UpdateResult
from omada_certificate_updater.runner import (
    CertificateUpdater,
    RenewalTimeoutError,
    VerificationTimeoutError,
)

NOW = datetime(2026, 8, 21, tzinfo=UTC)
TEST_HOSTNAME = "switch.example.test"


def make_material(
    *,
    days_valid: int,
    private_key: rsa.RSAPrivateKey | None = None,
) -> TlsMaterial:
    key = private_key or rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, TEST_HOSTNAME)])
    certificate = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(NOW - timedelta(days=1))
        .not_valid_after(NOW + timedelta(days=days_valid))
        .sign(key, hashes.SHA256())
    )
    return TlsMaterial(
        private_key=key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        ),
        certificate=certificate.public_bytes(serialization.Encoding.PEM),
    )


SETTINGS = Settings(
    username="test-user",
    password="test-password",
    url=f"https://{TEST_HOSTNAME}",
    namespace="tls-system",
    secret_name=TEST_HOSTNAME,
    certificate_name=TEST_HOSTNAME,
    expiry_threshold_days=5,
    renewal_timeout_seconds=10,
)


@dataclass
class FakeStore:
    materials: list[TlsMaterial]
    reads: int = 0

    def read_tls_material(self, namespace: str, secret_name: str) -> TlsMaterial:
        del namespace, secret_name
        material = self.materials[min(self.reads, len(self.materials) - 1)]
        self.reads += 1
        return material


@dataclass
class FakeRenewer:
    calls: list[tuple[str, str]] = field(default_factory=list)

    def renew(self, namespace: str, certificate_name: str) -> None:
        self.calls.append((namespace, certificate_name))


@dataclass
class FakeSwitch:
    certificates: list[x509.Certificate]
    upload_error: Exception | None = None
    uploads: list[TlsMaterial] = field(default_factory=list)
    reads: int = 0

    def fetch_certificate(self, timeout_seconds: float = 30) -> x509.Certificate:
        del timeout_seconds
        certificate = self.certificates[min(self.reads, len(self.certificates) - 1)]
        self.reads += 1
        return certificate

    def upload(self, material: TlsMaterial) -> None:
        if self.upload_error:
            raise self.upload_error
        self.uploads.append(material)


@dataclass
class FakeClock:
    value: float = 0

    def monotonic(self) -> float:
        return self.value

    def sleep(self, seconds: float) -> None:
        self.value += seconds


def updater(store: FakeStore, renewer: FakeRenewer, switch: FakeSwitch) -> CertificateUpdater:
    clock = FakeClock()
    return CertificateUpdater(
        store,
        renewer,
        switch,
        now=lambda: NOW,
        monotonic=clock.monotonic,
        sleep=clock.sleep,
        poll_interval_seconds=1,
        verification_timeout_seconds=3,
    )


def cert(material: TlsMaterial) -> x509.Certificate:
    return load_leaf_certificate(material.certificate)


def test_fresh_matching_certificate_does_nothing() -> None:
    current = make_material(days_valid=30)
    store = FakeStore([current])
    renewer = FakeRenewer()
    switch = FakeSwitch([cert(current)])

    result = updater(store, renewer, switch).run(SETTINGS)

    assert result is UpdateResult.CURRENT
    assert renewer.calls == []
    assert switch.uploads == []


def test_secret_mismatch_uploads_key_and_certificate() -> None:
    served = make_material(days_valid=30)
    replacement = make_material(days_valid=60)
    store = FakeStore([replacement])
    renewer = FakeRenewer()
    switch = FakeSwitch([cert(served), cert(replacement)])

    result = updater(store, renewer, switch).run(SETTINGS)

    assert result is UpdateResult.UPDATED
    assert renewer.calls == []
    assert switch.uploads == [replacement]


def test_near_expiry_renews_and_reuses_private_key() -> None:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    expiring = make_material(days_valid=2, private_key=key)
    renewed = make_material(days_valid=60, private_key=key)
    store = FakeStore([expiring, expiring, renewed])
    renewer = FakeRenewer()
    switch = FakeSwitch([cert(expiring), cert(renewed)])

    result = updater(store, renewer, switch).run(SETTINGS)

    assert result is UpdateResult.UPDATED
    assert renewer.calls == [(SETTINGS.namespace, SETTINGS.certificate_name)]
    assert switch.uploads == [renewed]
    assert renewed.private_key == expiring.private_key


def test_near_expiry_accepts_rotated_private_key() -> None:
    expiring = make_material(days_valid=2)
    renewed = make_material(days_valid=60)
    store = FakeStore([expiring, renewed])
    renewer = FakeRenewer()
    switch = FakeSwitch([cert(expiring), cert(renewed)])

    result = updater(store, renewer, switch).run(SETTINGS)

    assert result is UpdateResult.UPDATED
    assert switch.uploads == [renewed]
    assert renewed.private_key != expiring.private_key


def test_renewal_timeout_fails_without_uploading() -> None:
    expiring = make_material(days_valid=2)
    store = FakeStore([expiring])
    renewer = FakeRenewer()
    switch = FakeSwitch([cert(expiring)])

    with pytest.raises(RenewalTimeoutError):
        updater(store, renewer, switch).run(SETTINGS)

    assert switch.uploads == []


def test_invalid_key_pair_fails_before_switch_update() -> None:
    certificate_material = make_material(days_valid=30)
    other_material = make_material(days_valid=30)
    invalid = TlsMaterial(
        private_key=other_material.private_key,
        certificate=certificate_material.certificate,
    )
    store = FakeStore([invalid])
    renewer = FakeRenewer()
    switch = FakeSwitch([cert(certificate_material)])

    with pytest.raises(CertificateError, match="does not match"):
        updater(store, renewer, switch).run(SETTINGS)

    assert switch.uploads == []


def test_upload_error_is_propagated() -> None:
    served = make_material(days_valid=30)
    replacement = make_material(days_valid=60)
    store = FakeStore([replacement])
    switch = FakeSwitch([cert(served)], upload_error=RuntimeError("upload failed"))

    with pytest.raises(RuntimeError, match="upload failed"):
        updater(store, FakeRenewer(), switch).run(SETTINGS)


def test_post_upload_verification_timeout_fails() -> None:
    served = make_material(days_valid=30)
    replacement = make_material(days_valid=60)
    store = FakeStore([replacement])
    switch = FakeSwitch([cert(served)])

    with pytest.raises(VerificationTimeoutError):
        updater(store, FakeRenewer(), switch).run(SETTINGS)

    assert switch.uploads == [replacement]
