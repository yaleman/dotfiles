#!python3
from functools import lru_cache
import os
from pathlib import Path
import sys
from typing import Optional, Set

import click

# the key is what it ends up as, the list of values is the things that get replaced
BAD_CHAR_MAPS = {
    "-" : [ "|" ]
}

BAD_CHARS = {" — ", "{", "}", "!", "@", "#", "$", "%", "^", "&", "*", "=",  "\\", "/", "?", "<", ">", ":", ";", "`", "“","”"}

@lru_cache()
def all_bad_chars()-> Set[str]:
    all_chars = set()
    for key, values in BAD_CHAR_MAPS.items():
        all_chars.add(key)
        all_chars.update(values)
    return set.union(all_chars, BAD_CHARS)

@click.command()
@click.argument("filepath", type=click.Path(exists=True), envvar='FIX_NEXTCLOUD_DEFAULT_PATH')
@click.option("--debug", is_flag=True)
def fix_nextcloud_filenames(filepath: str, debug: Optional[bool]=False) -> None:

    path = Path(filepath)

    if not path.exists():
        print(f"File {path} does not exist.")
        sys.exit(1)

    print(f"Checking {filepath}", file=sys.stderr)


    for filename in path.iterdir():
        if filename.is_file():
            if any(char in filename.name for char in all_bad_chars()):
                new_name = str(filename.name)
                for char in BAD_CHARS:
                    new_name = new_name.replace(char, " ")
                while "  " in new_name:
                    new_name = new_name.replace("  ", " ")

                for (key, values) in BAD_CHAR_MAPS.items():
                    for value in values:
                        new_name = new_name.replace(value, key)

                new_name = new_name.strip()

                new_filepath = filename.parent / new_name


                if new_name != filename.name:
                    print(f"Renaming '{filename}' to '{new_filepath}'")
                    filename.rename(new_filepath)


if __name__ == "__main__":
    fix_nextcloud_filenames()
