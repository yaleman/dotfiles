""" diffing strings! """
import sys
import click


from typing import Optional, Tuple


def diff_string_suffix(string1: str, string2: str) -> Optional[Tuple[str, str]]:
    """compare two strings and find which one is the suffix of the other"""

    if string1 == string2:
        return None

    if string1.startswith(string2):
        """the first string starts with the second string"""
        return string1[len(string2) :], ""
    if string2.startswith(string2):
        """the second string starts with the first string"""
        return "", string2[len(string1) :]


@click.command()
@click.argument("string1")
@click.argument("string2")
@click.option("-m", "--matching", is_flag=True, help="Show the matching bits")
def main(string1: str = "", string2: str = "", matching: bool = False):
    """main function"""

    result = diff_string_suffix(string1, string2)
    if result is None:
        print("Strings are the same!", file=sys.stderr)
        if matching:
            print(string1)
        return
    if result[0]:
        print(f"String 1 is longer: {result[0]}", file=sys.stderr)
        if matching:
            print(string1.replace(result[0], ""))
        else:
            print(result[0])
    if result[1]:
        print(f"String 2 is longer: {result[1]}", file=sys.stderr)
        if matching:
            print(string1)


if __name__ == "__main__":
    main()
