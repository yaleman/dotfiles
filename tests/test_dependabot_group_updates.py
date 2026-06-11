from typing import Any

from dependabot_group_updates import apply_ecosystem_groups


def test_apply_ecosystem_groups_adds_group_per_ecosystem() -> None:
    config: dict[str, Any] = {
        "version": 2,
        "updates": [
            {
                "package-ecosystem": "github-actions",
                "directory": "/",
                "schedule": {
                    "interval": "weekly",
                    "day": "saturday",
                    "time": "02:00",
                    "timezone": "Australia/Brisbane",
                },
            }
        ],
    }

    changed = apply_ecosystem_groups(config)

    assert changed is True
    updates = config["updates"]
    assert updates[0]["groups"] == {
        "github-actions": {
            "patterns": ["*"],
        }
    }
