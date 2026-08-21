from __future__ import annotations

import base64
import binascii
import subprocess

from kubernetes import client, config
from kubernetes.client.exceptions import ApiException
from kubernetes.config.config_exception import ConfigException

from omada_certificate_updater.models import TlsMaterial


class KubernetesError(RuntimeError):
    """A required Kubernetes operation failed."""


class KubernetesStore:
    def __init__(self) -> None:
        try:
            config.load_incluster_config()
        except ConfigException as exc:
            raise KubernetesError(f"could not load in-cluster Kubernetes configuration: {exc}") from exc
        self._core = client.CoreV1Api()

    def read_tls_material(self, namespace: str, secret_name: str) -> TlsMaterial:
        try:
            secret = self._core.read_namespaced_secret(name=secret_name, namespace=namespace)
        except ApiException as exc:
            detail = exc.reason or f"Kubernetes API returned status {exc.status}"
            raise KubernetesError(f"could not read Secret {namespace}/{secret_name}: {detail}") from exc

        data = secret.data
        if not isinstance(data, dict):
            raise KubernetesError(f"Secret {namespace}/{secret_name} has no data")

        decoded: dict[str, bytes] = {}
        for field in ("tls.key", "tls.crt"):
            encoded = data.get(field)
            if not isinstance(encoded, str) or not encoded:
                raise KubernetesError(f"Secret {namespace}/{secret_name} has no {field}")
            try:
                decoded[field] = base64.b64decode(encoded, validate=True)
            except (binascii.Error, ValueError) as exc:
                raise KubernetesError(f"Secret {namespace}/{secret_name} has invalid base64 in {field}") from exc

        return TlsMaterial(private_key=decoded["tls.key"], certificate=decoded["tls.crt"])


class CmctlRenewer:
    def renew(self, namespace: str, certificate_name: str) -> None:
        command = ["cmctl", "renew", certificate_name, "--namespace", namespace]
        try:
            subprocess.run(command, check=True)
        except FileNotFoundError as exc:
            raise KubernetesError("cmctl is not installed in the updater image") from exc
        except subprocess.CalledProcessError as exc:
            raise KubernetesError(
                f"cmctl could not renew Certificate {namespace}/{certificate_name}"
            ) from exc
