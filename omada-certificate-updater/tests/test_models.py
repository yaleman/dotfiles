import pytest

from omada_certificate_updater.models import ConfigurationError, Settings


def valid_environment() -> dict[str, str]:
    return {
        "OMADA_USERNAME": "test-user",
        "OMADA_PASSWORD": "test-password",
        "OMADA_URL": "https://switch.example.test/",
        "OMADA_K8S_NAMESPACE": "tls-system",
        "OMADA_K8S_SECRET_NAME": "switch.example.test",
        "OMADA_CERTIFICATE_NAME": "switch.example.test",
        "OMADA_EXPIRY_THRESHOLD_DAYS": "5",
        "OMADA_RENEWAL_TIMEOUT_SECONDS": "600",
    }


def test_settings_are_loaded_entirely_from_environment() -> None:
    settings = Settings.from_env(valid_environment())

    assert settings.url == "https://switch.example.test"
    assert settings.expiry_threshold_days == 5
    assert settings.renewal_timeout_seconds == 600


def test_missing_environment_value_is_rejected() -> None:
    environment = valid_environment()
    del environment["OMADA_URL"]

    with pytest.raises(ConfigurationError, match="OMADA_URL is required"):
        Settings.from_env(environment)


def test_invalid_integer_environment_value_is_rejected() -> None:
    environment = valid_environment()
    environment["OMADA_EXPIRY_THRESHOLD_DAYS"] = "soon"

    with pytest.raises(ConfigurationError, match="must be an integer"):
        Settings.from_env(environment)
