import json
import sys

from lzstring import LZString


def main() -> None:
    encoded = sys.stdin.read().strip()

    decoded = LZString().decompressFromBase64(encoded)
    if decoded is None:
        raise SystemExit("Failed to decompress save data")

    try:
        data = json.loads(decoded)
    except json.JSONDecodeError:
        # Still useful if the save isn't valid JSON for some reason.
        print(decoded)
        return

    print(json.dumps(data, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
