""" find the 'git' file path for a given path """

import os
from pathlib import Path
import subprocess

# import sys
from typing import Optional

import click


def get_git_basedir() -> Optional[str]:
    """get the base dir of the current git repo"""
    cmd = "git rev-parse --show-toplevel".split()
    try:
        res = subprocess.check_output(cmd)
        return res.decode("utf-8").strip()
    except subprocess.CalledProcessError:
        return None


@click.command()
@click.argument("filepath", type=click.Path(exists=True))
def main(filepath: click.Path) -> int:
    pwd = Path(os.getcwd())
    if filepath.startswith("./"):
        filepath = filepath.lstrip("./")
    filepath = str(Path(filepath).resolve())
    # print(f"git-file-ref: {filepath=}", file=sys.stderr)
    # you're in the git repo
    if get_git_basedir() == pwd:
        print(filepath)
        return 0
    else:
        # print("you're not in the base!", file=sys.stderr)
        git_basedir = get_git_basedir()
        # print(f"git-file-ref: {git_basedir=}", file=sys.stderr)
        if git_basedir is None:
            return 1
        # print(f"git-file-ref {filepath=}", file=sys.stderr)
        result = f"{filepath}".replace(git_basedir, "").lstrip("/")
        # print(f"git-file-ref {result=}", file=sys.stderr)
        print(result)


if __name__ == "__main__":
    main()
