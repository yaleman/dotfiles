#!python


import sys

import click
from PyPDF2 import PdfReader


def validate_pdf_password(reader, password) -> bool:
    try:
        if reader.decrypt(password) == 0:
            return False
        return True
    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)


@click.command()
@click.argument("filename")
def main(filename: str) -> None:
    """Tries to guess the password for a PDF file that uses birthday as the password"""
    min_year = 2024 - 65
    max_year = 2024 - 16
    reader = PdfReader(filename)

    min_month = 1
    max_month = 12

    min_day = 1
    max_day = 31

    print(f"testing years between {min_year} and {max_year}")
    print(f"testing months {min_month}-{max_month}")
    print(f"testing days {min_day}-{max_day}")
    for year in range(min_year, max_year + 1):
        for month in range(min_month, max_month + 1):
            for day in range(min_day, max_day + 1):
                password = f"{year}/{month:02}/{day:02}"
                if validate_pdf_password(reader, password):
                    print(f"Password is: {password}")
                    return
    print("Couldn't find the password :(")


if __name__ == "__main__":
    main()
