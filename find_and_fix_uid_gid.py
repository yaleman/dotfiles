#!python3

# sometimes your system has a UID or GID that is no longer valid, and you need to change it to a new one
# and the find command can't deal with u64!

from pathlib import Path
import sys
from typing import Optional, Set

import os
import argparse

IGNORE_ROOTS = (
    "/proc",
    "/sys",
    "/dev",
)


def do_thing(
    file_path: Path, uid: Optional[int], gid: Optional[int], new_uid: Optional[int], new_gid: Optional[int], debug: bool
) -> None:
    if debug:
        print(f"Checking {file_path}")

    try:
        file_stat = os.stat(file_path)
        if (uid is not None and file_stat.st_uid == uid) or (gid is not None and file_stat.st_gid == gid):
            print(f"Found matching file='{file_path}' UID={file_stat.st_uid}, GID={file_stat.st_gid}")
            if new_uid is not None and file_stat.st_uid != new_uid:
                new_file_uid = new_uid
            else:
                new_file_uid = file_stat.st_uid
            if new_gid is not None and file_stat.st_gid != new_gid:
                new_file_gid = new_gid
            else:
                new_file_gid = file_stat.st_gid
            os.chown(file_path, new_file_uid, new_file_gid)
        else:
            if debug:
                print(f"Skipping file='{file_path}' UID={file_stat.st_uid}, GID={file_stat.st_gid}")
    except PermissionError as error:
        print(f"Permission denied: file_path={file_path} error={error}")
    except FileNotFoundError:
        if debug:
            print(f"File not found: file_path={file_path}")
    except Exception as error:
        print(f"Error processing file_path={file_path}: error={error}")


def find_files_by_uid_gid(
    start_path: str,
    uid: Optional[int] = None,
    gid: Optional[int] = None,
    new_uid: Optional[int] = None,
    new_gid: Optional[int] = None,
    debug: bool = False,
) -> None:
    if uid is None and gid is None:
        print("No UID or GID provided, exiting")
        sys.exit(1)

    done_paths: Set[Path] = set()

    for root, _dirs, files in os.walk(start_path):
        if root in IGNORE_ROOTS or root.startswith(tuple(IGNORE_ROOTS)):
            if debug:
                print(f"Skipping root={root}")
            continue
        for file in files:
            file_path = Path(os.path.join(root, file))
            if not file_path.is_file() and not file_path.is_dir():
                if debug:
                    print(f"Skipping as not file/dir: {file_path}", file=sys.stderr)
                continue
            if file_path not in done_paths:
                do_thing(file_path, uid, gid, new_uid, new_gid, debug)
                done_paths.add(file_path)

            if file_path.parent not in done_paths:
                do_thing(file_path.parent.resolve(), uid, gid, new_uid, new_gid, debug)
                done_paths.add(file_path.parent)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Find and fix UID/GID in files.")
    parser.add_argument("start_path", help="The starting path to search")
    parser.add_argument("-u", "--uid", type=int, help="The UID to search for")
    parser.add_argument("-g", "--gid", type=int, help="The GID to search for")
    parser.add_argument("--new-uid", type=int, help="The new UID to set")
    parser.add_argument("--new-gid", type=int, help="The new GID to set")
    parser.add_argument("--debug", action="store_true", help="Enable debug output")

    args = parser.parse_args()

    find_files_by_uid_gid(
        start_path=args.start_path,
        uid=args.uid,
        gid=args.gid,
        new_uid=args.new_uid,
        new_gid=args.new_gid,
        debug=args.debug,
    )
