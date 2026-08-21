from __future__ import annotations

import sys

from omada_certificate_updater.certificates import CertificateError
from omada_certificate_updater.kubernetes_store import (
    CmctlRenewer,
    KubernetesError,
    KubernetesStore,
)
from omada_certificate_updater.models import ConfigurationError, Settings
from omada_certificate_updater.runner import (
    CertificateUpdater,
    RenewalTimeoutError,
    VerificationTimeoutError,
)
from omada_certificate_updater.switch import OmadaSwitch, SwitchError


def main() -> int:
    try:
        settings = Settings.from_env()
        store = KubernetesStore()
        updater = CertificateUpdater(
            store=store,
            renewer=CmctlRenewer(),
            switch=OmadaSwitch(settings.url, settings.username, settings.password),
        )
        updater.run(settings)
    except (
        CertificateError,
        ConfigurationError,
        KubernetesError,
        RenewalTimeoutError,
        SwitchError,
        VerificationTimeoutError,
    ) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
