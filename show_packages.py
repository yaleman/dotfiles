#!/usr/bin/python3

from dataclasses import dataclass
from enum import StrEnum
import json
import logging
from optparse import OptionParser, Values
import os
import re
from shutil import which
import subprocess
import sys
from typing import Dict, Optional


class PackageState(StrEnum):
    """package state"""

    INSTALLED = "installed"
    USERINSTALLED = "user-installed"
    DEPENDENCY = "dependency"
    UNKNOWN = "unknown"

    def from_zypper(value: str) -> "PackageState":
        """In the Status column the search command distinguishes between
        user installed packages (i+) and
        automatically installed packages (i)."""
        if value == "i":
            return PackageState.DEPENDENCY
        if value == "i+":
            return PackageState.USERINSTALLED
        return PackageState.UNKNOWN


@dataclass
class Package:
    name: str
    description: Optional[str] = None

    version: Optional[str] = None
    update_version: Optional[str] = None
    update_repo: Optional[str] = None

    arch: Optional[str] = None
    state: Optional[str] = None

    def dict_without_nulls(self) -> dict[str, str]:
        """return a dict without null values"""
        return {
            key: value
            for key, value in self.__dict__.items()
            if value is not None and value != ""
        }


def try_zypper(options: Values) -> bool:
    """try the zypper package manager"""
    zypper = which("zypper")
    if zypper is None:
        return False

    logging.debug("zypper is available")
    # TODO: update this to use zypper search -i -v and parse because you don't get version etc from the base search
    # run 'zypper search -i' and collect the output

    cmd = [zypper, "search", "-i"]
    try:
        output = output = subprocess.run(
            cmd, capture_output=True, check=True, encoding="utf-8"
        )
    except subprocess.CalledProcessError as error:
        logging.error("Failed to run %s: %s", " ".join(cmd), error)
        return False
    except Exception as error:
        logging.error("Failed to run %s: %s", " ".join(cmd), error)
        return False
    # this parses the default line response
    zypper_parser = re.compile(
        r"^(?P<state>\S+)\s+\|\s+(?P<name>\S+)\s+\|\s+(?P<description>[^\|]+)"
    )
    results: Dict[str, Package] = {}

    for line in output.stdout.splitlines():
        parsed = zypper_parser.search(line.strip())
        if parsed is None:
            logging.debug(f"Skipping line: {line}")
            continue

        package = Package(
            name=parsed.group("name"),
            description=(
                parsed.group("description").strip()
                if options.include_descriptions
                else None
            ),
            state=PackageState.from_zypper(parsed.group("state")).value,
        )
        results[package.name] = package

    # now we look for updates
    cmd = ["zypper", "list-updates"]
    update_check_failed = False
    try:
        output = output = subprocess.run(
            cmd, capture_output=True, check=True, encoding="utf-8"
        )
    except subprocess.CalledProcessError as error:
        logging.error("Failed to run %s: %s", " ".join(cmd), error)
        update_check_failed = True
        # this parses the default line response
    except Exception as error:
        logging.error("Failed to run %s: %s", " ".join(cmd), error)
        update_check_failed = True

    if not update_check_failed:
        update_parser = re.compile(
            r"^\w+\s+\|\s+(?P<repo_name>[^|]+)\s+\|\s+(?P<name>\S+)\s+\|\s+(?P<version>\S+)\s+\|\s+(?P<version_update>\S+)\s+\|\s+(?P<arch>\S+)"
        )  # noqa: E501
        for line in output.stdout.splitlines():
            parsed = update_parser.search(line.strip())
            if parsed is None:
                logging.debug(f"Skipping line: {line}")
                continue
            package_name = parsed.group("name")
            if package_name in results:
                package = results[package_name]
            else:
                package = Package(name=package_name)
            if package.version is not None and package.version != parsed.group(
                "version"
            ):
                logging.warn(
                    "Version mismatch for: %s installed: %s update says we have %s",
                    package_name,
                    package.version,
                    parsed.group("version"),
                )
            else:
                package.version = parsed.group("version")
            package.update_version = parsed.group("version_update")
            package.update_repo = parsed.group("repo_name")
            package.arch = parsed.group("arch")
            results[package_name] = package
            # logging.info("Update package: %s", json.dumps(package.__dict__))
    for package in results.values():
        print(json.dumps(package.dict_without_nulls()))
    return True


def setup_logging(options: Values) -> None:
    """does what it says on the tin"""
    if options.debug:
        log_level = "DEBUG"
    else:
        log_level = os.getenv("LOG_LEVEL", "INFO")
    logging.basicConfig(level=log_level, stream=sys.stderr)


def main() -> None:
    """main function"""

    parser = OptionParser()
    parser.add_option(
        "-d",
        "--debug",
        action="store_true",
        dest="debug",
        default=False,
        help="Enable debug logging",
    )
    parser.add_option(
        "-D",
        "--descriptions",
        action="store_true",
        dest="include_descriptions",
        default=False,
        help="Include descriptions",
    )

    (options, _) = parser.parse_args()

    setup_logging(options)

    if try_zypper(options):
        return


if __name__ == "__main__":
    main()
