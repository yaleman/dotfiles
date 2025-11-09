#!/usr/bin/env python
# Hook to check if an llm is going to use "yaelman" in a path because it's stupid and keeps screwing this up

import sys
from typing import TextIO


def check_input(data: TextIO) -> None:
    for line in data:
        if "yaelman" in line:
            print(
                "Error: Detected usage of 'yaelman' in the path. NEVER use 'yaelman' in paths.",
                file=sys.stderr,
            )
            sys.exit(2)


if __name__ == "__main__":
    check_input(sys.stdin)
