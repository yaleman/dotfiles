from __future__ import annotations

import re
from datetime import UTC, datetime

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization

from omada_certificate_updater.models import TlsMaterial

PEM_CERTIFICATE_PATTERN = re.compile(
    rb"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----",
    re.DOTALL,
)


class CertificateError(ValueError):
    """Certificate or private-key material is invalid."""


def leaf_certificate_pem(bundle: bytes) -> bytes:
    certificates = PEM_CERTIFICATE_PATTERN.findall(bundle)
    if not certificates:
        raise CertificateError("certificate data contains no PEM certificate")
    return certificates[0] + b"\n"


def load_leaf_certificate(bundle: bytes) -> x509.Certificate:
    try:
        return x509.load_pem_x509_certificate(leaf_certificate_pem(bundle))
    except ValueError as exc:
        raise CertificateError("could not parse the leaf certificate") from exc


def fingerprint(certificate: x509.Certificate) -> str:
    return certificate.fingerprint(hashes.SHA256()).hex()


def validate_tls_material(material: TlsMaterial, now: datetime) -> x509.Certificate:
    certificate = load_leaf_certificate(material.certificate)
    try:
        private_key = serialization.load_pem_private_key(material.private_key, password=None)
    except (TypeError, ValueError) as exc:
        raise CertificateError("could not parse tls.key") from exc

    certificate_public_key = certificate.public_key().public_bytes(
        serialization.Encoding.DER,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    private_public_key = private_key.public_key().public_bytes(
        serialization.Encoding.DER,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    if certificate_public_key != private_public_key:
        raise CertificateError("tls.key does not match the leaf certificate")

    normalized_now = now.astimezone(UTC)
    if certificate.not_valid_after_utc <= normalized_now:
        raise CertificateError("the Kubernetes Secret contains an expired certificate")
    if certificate.not_valid_before_utc > normalized_now:
        raise CertificateError("the Kubernetes Secret contains a certificate that is not yet valid")
    return certificate
