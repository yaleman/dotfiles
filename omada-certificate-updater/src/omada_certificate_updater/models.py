from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum


class ConfigurationError(ValueError):
    """The environment does not contain valid updater configuration."""


class UpdateResult(StrEnum):
    CURRENT = "current"
    UPDATED = "updated"


@dataclass(frozen=True)
class Settings:
    username: str
    password: str
    url: str
    namespace: str
    secret_name: str
    certificate_name: str
    expiry_threshold_days: int
    renewal_timeout_seconds: int

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> Settings:
        values = os.environ if environ is None else environ

        def required(name: str) -> str:
            value = values.get(name, "").strip()
            if not value:
                raise ConfigurationError(f"{name} is required")
            return value

        def positive_integer(name: str) -> int:
            raw = required(name)
            try:
                value = int(raw)
            except ValueError as exc:
                raise ConfigurationError(f"{name} must be an integer") from exc
            if value <= 0:
                raise ConfigurationError(f"{name} must be greater than zero")
            return value

        return cls(
            username=required("OMADA_USERNAME"),
            password=required("OMADA_PASSWORD"),
            url=required("OMADA_URL").rstrip("/"),
            namespace=required("OMADA_K8S_NAMESPACE"),
            secret_name=required("OMADA_K8S_SECRET_NAME"),
            certificate_name=required("OMADA_CERTIFICATE_NAME"),
            expiry_threshold_days=positive_integer("OMADA_EXPIRY_THRESHOLD_DAYS"),
            renewal_timeout_seconds=positive_integer("OMADA_RENEWAL_TIMEOUT_SECONDS"),
        )


@dataclass(frozen=True)
class TlsMaterial:
    private_key: bytes
    certificate: bytes
