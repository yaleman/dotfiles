#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = [
# "click"
# ]
# ///

import json
from pathlib import Path
import click


@click.command()
@click.argument("zone")
@click.argument("filename", type=click.File("r"))
def main(zone: str, filename: click.File) -> None:
    data = json.load(Path(filename.name).open(encoding="utf-8")).get("result")
    for record in data:
        if record["name"] == zone:
            record["name"] = "@"
        elif record["name"].endswith(zone):
            record["name"] = record["name"].replace(f".{zone}", "")
        else:
            raise ValueError(f"Record {record['name']} does not end with {zone}")
        for field in ["meta", "settings", "created_on", "modified_on", "tags"]:
            del record[field]
        print(json.dumps(record))


if __name__ == "__main__":
    main()
