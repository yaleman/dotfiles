#!/usr/bin/env uv run --script
# /// script
# dependencies = [
#   "pyyaml","click"
# ]
# ///
from __future__ import annotations

from pathlib import Path
from typing import Any

import click
import yaml  # type: ignore[import-untyped]

DEFAULT_DEPENDABOT_PATH = Path(".github/dependabot.yml")
DEFAULT_GROUP_PATTERNS = ["*"]


def _ecosystem_group_name(ecosystem: str) -> str:
    return ecosystem.strip()


def _ensure_update_groups(update: dict[str, Any]) -> bool:
    ecosystem = update.get("package-ecosystem")
    if not isinstance(ecosystem, str) or not ecosystem.strip():
        raise click.ClickException("Each Dependabot update entry must define a package-ecosystem.")

    groups = update.get("groups")
    if groups is None:
        # have to re-do the list because otherwise pyyaml will make references
        update["groups"] = {_ecosystem_group_name(ecosystem): {"patterns": [item for item in DEFAULT_GROUP_PATTERNS]}}
        return True

    if not isinstance(groups, dict):
        raise click.ClickException("Dependabot update groups must be a mapping.")

    group_name = _ecosystem_group_name(ecosystem)
    if group_name in groups:
        return False

    # have to re-do the list because otherwise pyyaml will make references
    groups[group_name] = {"patterns": [item for item in DEFAULT_GROUP_PATTERNS]}
    return True


def apply_ecosystem_groups(config: dict[str, Any]) -> bool:
    updates = config.get("updates")
    if not isinstance(updates, list):
        raise click.ClickException("Dependabot config must contain an updates list.")

    changed = False
    for update in updates:
        if not isinstance(update, dict):
            raise click.ClickException("Each Dependabot update entry must be a mapping.")
        if _ensure_update_groups(update):
            changed = True
    return changed


def load_config(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise click.ClickException(f"{path} does not exist.")

    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise click.ClickException(f"{path} does not contain a Dependabot config mapping.")
    return data


def write_config(path: Path, config: dict[str, Any]) -> None:
    rendered = yaml.safe_dump(
        config,
        sort_keys=False,
        default_flow_style=False,
    )
    path.write_text(rendered, encoding="utf-8")


@click.command()
@click.option(
    "--path",
    "dependabot_path",
    type=click.Path(path_type=Path, dir_okay=False, readable=True, writable=True),
    default=DEFAULT_DEPENDABOT_PATH,
    show_default=True,
    help="Path to the Dependabot config file to update.",
)
def main(dependabot_path: Path) -> None:
    config = load_config(dependabot_path)
    changed = apply_ecosystem_groups(config)

    if changed:
        write_config(dependabot_path, config)
        click.echo(f"Updated {dependabot_path} with ecosystem-based groups.", err=True)
    else:
        click.echo(f"{dependabot_path} already has ecosystem-based groups.", err=True)


if __name__ == "__main__":
    main()
