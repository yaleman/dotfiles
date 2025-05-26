#!python3
import argparse
import json
import os.path
import os
from pathlib import Path
import sys
from pydantic.dataclasses import dataclass


@dataclass
class ConfigFile:
    one_to_one: list[str]
    public_maps: dict[str, str]
    private_maps: dict[str, str]

    @classmethod
    def load_file(cls, filepath: Path) -> "ConfigFile":
        valid_keys = ("one_to_one", "public_maps", "private_maps")
        data = json.loads(open(filepath, "r", encoding="utf-8").read())
        failed_validation = False
        for key in data.keys():
            if key not in valid_keys:
                print(f"Found invalid key in config: {key}")
                failed_validation = True
        if failed_validation:
            print("Config failed validation, bailing")
            sys.exit(1)
        for key in valid_keys:
            if key not in data:
                print(f"Missing key in config: {key}")
        return ConfigFile(**data)


# argparse setup
parser = argparse.ArgumentParser(description="Setup dotfiles")
parser.add_argument("--debug", action="store_true", help="Enable debug mode")
parser.add_argument("--show-config", action="store_true", help="Show config and exit")
parser.add_argument("--public-path", default=os.getenv("DOTFILE_DIR_PUBLIC"), help="Path to 'public' dotfile folder")
parser.add_argument("--private-path", default=os.getenv("DOTFILE_DIR"), help="Path to 'private' dotfiles folder")
parser.add_argument("--config-file", help="Path to config file")
args = parser.parse_args()


if args.private_path is None:
    print("Please set the DOTFILE_DIR environment variable or pass it as the --private-path argument")
    sys.exit(1)
if args.public_path is None:
    print("Please set the DOTFILE_DIR_PUBLIC environment variable or pass it as the --public-path argument")
    sys.exit(1)

private_path = os.path.expanduser(args.private_path)
public_path = os.path.expanduser(args.public_path)

if not os.path.exists(private_path):
    print(f"Private path {private_path} does not exist, bailing!")
    sys.exit(1)
if not os.path.exists(public_path):
    print(f"Public path {public_path} does not exist, bailing!")
    sys.exit(1)

if args.config_file is None:
    config_path = os.path.expanduser(os.path.join(private_path, "dotfiles.json"))
else:
    config_path = os.path.expanduser(args.config_file)

if not os.path.exists(config_path):
    print(f"Config file {config_path} does not exist, bailing!")
    sys.exit(1)

config_file = ConfigFile.load_file(Path(config_path))

if args.show_config:
    print(json.dumps(config_file, indent=4))
    sys.exit(0)

# one_to_one is mapped <private_path> -> ~/<filename>
for filename in config_file.one_to_one:
    source = os.path.join(args.private_path, filename)
    target = os.path.join(os.path.expanduser("~/"), filename)
    if not os.path.exists(target):
        print(f"Creating link {target} -> {source}")
        os.symlink(source, target, os.path.isdir(source))
    else:
        if os.path.islink(target):
            if args.debug:
                print(f"Link exists {target} -> {source}")
        else:
            print(f"{target} exists, but is not a link!")

# public_maps map <public_path>/key -> value
for key, value in config_file.public_maps.items():
    source = os.path.join(public_path, key)
    target = os.path.expanduser(value)
    if not os.path.exists(target):
        print(f"Creating link for {target} -> {source}")
        os.symlink(source, target, os.path.isdir(source))
    else:
        if os.path.islink(target):
            if args.debug:
                print(f"Link exists {target} -> {source}")
        else:
            print(f"{target} exists, but is not a link!")

# private_maps map <private_path>/key -> value
for source, target in config_file.private_maps.items():
    source = os.path.join(private_path, source)

    if not os.path.exists(source):
        print(f"Special source {source} does not exist, bailing")
        sys.exit(1)

    target_path = os.path.expanduser(target)

    if os.path.exists(target_path):
        if os.path.islink(target_path):
            if args.debug:
                print(f"Special target link {target} exists, skipping")
            continue
        else:
            print(f"Special target {target} exists, but is not a link!")
            continue

    print(f"Need to create link for {source} to {os.path.expanduser(target)}")

    if not Path(target).parent.exists():
        print(f"Creating parent dirs for {target}: {Path(target).parent}")
        Path(target).parent.mkdir(parents=True)
    os.symlink(source, target_path, os.path.isdir(source))
