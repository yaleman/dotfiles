#!/usr/bin/python3

from dataclasses import dataclass

import json
import logging
from optparse import OptionParser, Values
import os
import re
from shutil import which
import subprocess
import sys
from typing import Dict, Optional


class PackageState:
    """package state"""

    DEPENDENCY = "dependency"
    ERROR = "error"
    INSTALLATION_WARNING = "installation-warning"
    INSTALLED = "installed"
    UNKNOWN = "unknown"
    USERINSTALLED = "user-installed"
    REMOVED = "removed"
    PURGED = "purged"

    @classmethod
    def from_zypper(cls, value: str) -> str:
        """In the Status column the search command distinguishes between
        user installed packages (i+) and
        automatically installed packages (i)."""
        if value == "i":
            return PackageState.DEPENDENCY
        if value == "i+":
            return PackageState.USERINSTALLED
        return PackageState.UNKNOWN

    @classmethod
    def from_dpkg(cls, value: str) -> str:
        """from the dpkg output"""

        # Desired=Unknown/Install/Remove/Purge/Hold
        # | Status=Not/Inst/Conf-files/Unpacked/halF-conf/Half-inst/trig-aWait/Trig-pend
        # |/ Err?=(none)/Reinst-required (Status,Err: uppercase=bad)
        # man dpkg-query gives more detail
        #
        # First letter → desired package state ("selection state"):
        # u ... unknown
        # i ... install
        # r ... remove/deinstall
        # p ... purge (remove including config files)
        # h ... hold
        #
        # Second letter → current package state:
        # n ... not-installed
        # i ... installed
        # c ... config-files (only the config files are installed)
        # U ... unpacked
        # F ... half-configured (configuration failed for some reason)
        # h ... half-installed (installation failed for some reason)
        # W ... triggers-awaited (package is waiting for a trigger from another package)
        # t ... triggers-pending (package has been triggered)
        #
        # Third letter → error state (you normally shouldn't see a third letter, but a space, instead):
        # R ... reinst-required (package broken, reinstallation required)

        if len(value) == 3:
            return PackageState.ERROR

        desired = value[0]
        if desired == "r":
            return PackageState.REMOVED
        if desired == "p":
            return PackageState.PURGED

        status = value[1]
        if desired == "i":
            if status in ["i", "c"]:
                return PackageState.INSTALLED
            return PackageState.INSTALLATION_WARNING
        return PackageState.UNKNOWN


@dataclass
class Package:
    name: str
    description: Optional[str] = None

    version: Optional[str] = None
    update_version: Optional[str] = None
    update_repo: Optional[str] = None

    arch: Optional[str] = None
    state: str = "unknown"

    def dict_without_nulls(self) -> Dict[str, str]:
        """return a dict without null values"""
        return {key: value for key, value in self.__dict__.items() if value is not None and value != ""}


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
        output = output = subprocess.run(cmd, capture_output=True, check=True, encoding="utf-8")
    except subprocess.CalledProcessError as error:
        logging.error("Failed to run %s: %s", " ".join(cmd), error)
        return False
    except Exception as error:
        logging.error("Failed to run %s: %s", " ".join(cmd), error)
        return False
    # this parses the default line response
    zypper_parser = re.compile(r"^(?P<state>\S+)\s+\|\s+(?P<name>\S+)\s+\|\s+(?P<description>[^\|]+)")
    results: Dict[str, Package] = {}

    for line in output.stdout.splitlines():
        parsed = zypper_parser.search(line.strip())
        if parsed is None:
            logging.debug(f"Skipping line: {line}")
            continue

        package = Package(
            name=parsed.group("name"),
            description=(parsed.group("description").strip() if options.include_descriptions else None),
            state=PackageState.from_zypper(parsed.group("state")),
        )
        results[package.name] = package

    # now we look for updates
    cmd = ["zypper", "list-updates"]
    update_check_failed = False
    try:
        output = output = subprocess.run(cmd, capture_output=True, check=True, encoding="utf-8")
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
            if package.version is not None and package.version != parsed.group("version"):
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


def try_dpkg(options: Values) -> bool:
    """dpkg this time"""
    if which("dpkg") is None:
        return False

    logging.debug("dpkg is available")
    cmd = ["dpkg", "-l"]
    try:
        first_output = subprocess.run(cmd, capture_output=True, check=True, encoding="utf-8")
    except subprocess.CalledProcessError as error:
        logging.error("Failed to run %s: %s", " ".join(cmd), error)
        return False
    except Exception as error:
        logging.error("Failed to run %s: %s", " ".join(cmd), error)
        return False
    # this parses the default line response
    dpkg_parser = re.compile(
        r"^(?P<state>\S+)\s+(?P<name>\S+)\s+(?P<version>\S+)\s+(?P<arch>\S+)\s+(?P<description>.*)"
    )
    results: Dict[str, Package] = {}

    for line in first_output.stdout.splitlines():
        parsed = dpkg_parser.search(line.strip())
        if parsed is None:
            logging.debug(f"Skipping line: {line}")
            continue

        if parsed.group("name") == "Name" and parsed.group("version") == "Version":
            continue

        package = Package(
            name=parsed.group("name"),
            arch=parsed.group("arch"),
            version=parsed.group("version"),
            description=(parsed.group("description").strip() if options.include_descriptions else None),
            state=PackageState.from_dpkg(parsed.group("state")),
        )
        if package.state == PackageState.UNKNOWN:
            logging.warn(
                'Unknown state for package: %s line="%s"',
                json.dumps(package.__dict__),
                line,
            )
        results[package.name] = package
    cmd = ["apt", "list", "--upgradable"]
    failed = False
    try:
        update_output = subprocess.run(cmd, capture_output=True, check=True, encoding="utf-8")
    except subprocess.CalledProcessError as error:
        logging.error("Failed to run %s: %s", " ".join(cmd), error)
        failed = True
    except Exception as error:
        logging.error("Failed to run %s: %s", " ".join(cmd), error)
        failed = True
    if not failed:
        # util-linux-locales/oldoldstable 2.33.1-0.1+deb10u1 all [upgradable from: 2.33.1-0.1]
        update_parser = re.compile(
            r"^(?P<name>[^\/]+)\/\S+\s+(?P<update_version>[^ ]+) (?P<arch>\S+)\s+ \[upgradable from: (?P<version>[^ ]+)"
        )  # noqa: E501
        for line in update_output.stdout.splitlines():
            parsed = update_parser.search(line.strip())
            if parsed is not None:
                if parsed.group("name") in results:
                    package = results[parsed.group("name")]
                else:
                    package = Package(**parsed.groupdict())
                results[package.name] = package
    for package in results.values():
        if package.state in [PackageState.REMOVED, PackageState.PURGED]:
            if options.include_removed:
                print(json.dumps(package.dict_without_nulls()))
        else:
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
    parser.add_option(
        "-r",
        "--include-removed",
        action="store_true",
        dest="include_removed",
        default=False,
        help="Include removed and purged packages",
    )

    (options, _) = parser.parse_args()

    setup_logging(options)

    if try_zypper(options):
        return
    if try_dpkg(options):
        return


if __name__ == "__main__":
    main()
