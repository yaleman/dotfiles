#!python3

from pathlib import Path
import sys
import click

BAD_CHARS = [" — ", "{", "}", "!", "@", "#", "$", "%", "^", "&", "*", "=", "|", "\\", "/", "?", "<", ">", ":", ";", "`"]


@click.command()
@click.argument("filepath", type=click.Path(exists=True))
def fix_nextcloud_filenames(filepath: str) -> None:
    path = Path(filepath)

    if not path.exists():
        print(f"File {path} does not exist.")
        sys.exit(1)

    for filename in path.iterdir():
        if filename.is_file():
            if any(char in filename.name for char in BAD_CHARS):
                new_name = filename.name
                for char in BAD_CHARS:
                    new_name = new_name.replace(char, " ")
                while "  " in new_name:
                    new_name = new_name.replace("  ", " ")
                new_name = new_name.strip()
                new_filepath = filename.parent / new_name
                print(f"Renaming '{filename}' to '{new_filepath}'")
                filename.rename(new_filepath)


if __name__ == "__main__":
    fix_nextcloud_filenames()
