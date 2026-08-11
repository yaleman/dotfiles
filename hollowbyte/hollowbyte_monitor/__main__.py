#!/usr/bin/env python3
"""Executable entry point for the live RSS monitor."""

from .rss_monitor import run_cli


def main() -> None:
    raise SystemExit(run_cli())


if __name__ == "__main__":
    main()
