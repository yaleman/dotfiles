#!python


import sys
from pathlib import Path

import click
from PyPDF2 import PasswordType, PdfReader, PdfWriter


@click.command()
@click.argument("filename")
@click.argument("password")
def main(filename: str, password: str) -> None:
    """Strips the password from an encrypted PDF"""

    reader = PdfReader(filename)
    try:
        if reader.decrypt(password) == PasswordType.NOT_DECRYPTED:
            print("The password failed!")
            sys.exit(1)
        print("Password worked!")
    except Exception as e:  # noqa: BLE001
        print(f"An error occurred: {e}")
        sys.exit(1)
    # write the file to disk
    outpath = Path(filename)
    outpath_name_without_extension = ".".join(outpath.name.split(".")[:-1])
    outpath_extension = outpath.name.split(".")[-1]
    output_path = outpath.with_name(f"{outpath_name_without_extension}-decrypted.{outpath_extension}")
    with open(
        output_path.resolve(),
        "wb",
    ) as f:
        writer = PdfWriter()
        writer.clone_document_from_reader(reader)
        writer.write(f)
    print(f"Wrote file to {output_path}")


if __name__ == "__main__":
    main()
