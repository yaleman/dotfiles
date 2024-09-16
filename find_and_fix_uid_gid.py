#!python3

# sometimes your system has a UID or GID that is no longer valid, and you need to change it to a new one
# and the find command can't deal with u64!

from pathlib import Path
import sys
from typing import Optional
import click

import os


@click.command()
@click.argument("start_path")
@click.option("-u", "--uid", type=int, help="The UID to search for")
@click.option("-g", "--gid", type=int, help="The GID to search for")
@click.option("--new-uid", type=int, help="The new UID to set")
@click.option("--new-gid", type=int, help="The new GID to set")
def find_files_by_uid_gid(
    start_path: str,
    uid: Optional[int] = None,
    gid: Optional[int] = None,
    new_uid: Optional[int] = None,
    new_gid: Optional[int] = None,
) -> None:
    if uid is None and gid is None:
        print("No UID or GID provided, exiting")
        sys.exit(1)

    for root, _dirs, files in os.walk(start_path):
        for file in files:
            file_path = os.path.join(root, file)
            file_path_path = Path(file_path)
            if not file_path_path.is_file() and not file_path_path.is_dir():
                print(f"Skipping as not file/dir: {file_path}", file=sys.stderr)
                continue

            try:
                file_stat = os.stat(file_path)
                if file_stat.st_uid == uid or file_stat.st_gid == gid:
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
            except PermissionError as error:
                print(f"Permission denied: {file_path=} {error=}")
            except FileNotFoundError:
                print(f"File not found: {file_path=}")
            except Exception as error:
                print(f"Error processing {file_path=}: {error=}")


if __name__ == "__main__":
    find_files_by_uid_gid()
