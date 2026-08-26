import json
import sys

from lzstring import LZString


def main() -> None:
    data = json.load(sys.stdin)

    encoded = LZString().compressToBase64(json.dumps(data, separators=(",", ":")))

    print(encoded)


if __name__ == "__main__":
    main()
