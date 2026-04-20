#!/usr/bin/env python3

import sys
from pathlib import Path
from shutil import which
import tomlkit
import click

UV_CONFIG = Path.home() / ".config" / "uv" / "uv.toml"
PIP_CONFIG = Path.home() / ".config" / "pip" / "pip.conf"


def create_if_not_exists(config_file: Path) -> bool:
    if not config_file.parent.exists():
        config_file.parent.mkdir(parents=True)
    if not config_file.exists():
        config_file.touch()
        return True
    return False


def configure_uv(config_file: Path) -> bool:
    changed = False
    if create_if_not_exists(config_file):
        changed = True

    uv_data = tomlkit.parse(config_file.read_text(encoding="utf-8"))

    if "exclude-newer" not in uv_data:
        uv_data["exclude-newer"] = "P3D"  # "3 days" in RFC 3339 format
        changed = True

    if changed:
        config_file.write_text(tomlkit.dumps(uv_data))
        print(f"Updated {config_file} with uv dependency aging configuration.", file=sys.stderr)
    else:
        print(f"{config_file} already has the necessary configuration, no changes made.", file=sys.stderr)
    return changed


def configure_pip(config_file: Path) -> bool:
    """based on info in https://blog.pypi.org/posts/2026-04-02-incident-report-litellm-telnyx-supply-chain-attack/"""
    changed = False
    if create_if_not_exists(config_file):
        changed = True

    pip_data = tomlkit.parse(config_file.read_text(encoding="utf-8"))

    if pip_data.get("install", {}).get("uploaded-prior-to") != "P3D":
        pip_data["install"] = {"uploaded-prior-to": "P3D"}
        changed = True

    if changed:
        config_file.write_text(tomlkit.dumps(pip_data))
        print(f"Updated {config_file} with pip dependency aging configuration.", file=sys.stderr)
    else:
        print(f"{config_file} already has the necessary configuration, no changes made.", file=sys.stderr)
    return changed


@click.command()
@click.option("--force-uv", is_flag=True, help="Force configure uv even if it's not installed.")
@click.option("--force-pip", is_flag=True, help="Force configure pip even if it's not installed.")
def cli(force_uv: bool, force_pip: bool) -> None:
    if which("uv") is not None or force_uv:
        configure_uv(UV_CONFIG)
    else:
        print("uv is not installed, skipping configuration.", file=sys.stderr)

    if which("pip") is not None or force_pip:
        configure_pip(PIP_CONFIG)
    else:
        print("pip is not installed, skipping configuration.", file=sys.stderr)


if __name__ == "__main__":
    cli()
