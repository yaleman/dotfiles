#!/usr/bin/env python3


import sys
from datetime import datetime, timezone
import docker
import docker.errors
import click


@click.command()
@click.option("--days", default=7, help="Number of days before pulling the latest image")
@click.argument("container_name")
def pull_latest_ish(container_name: str, days: int) -> None:
    client = docker.from_env()
    try:
        image = client.images.get(container_name)
        created_time = image.attrs["Created"]
    except docker.errors.ImageNotFound:
        print(f"Pulling latest {container_name} image...", file=sys.stderr)
        client.images.pull(container_name)
        return
    created_time = created_time.rstrip("Z").split(".")[0] + "Z"
    created_dt = datetime.strptime(created_time, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    now_dt = datetime.now(timezone.utc)
    age_days = (now_dt - created_dt).days

    if age_days > days:
        print(f"Updating {container_name} image (age: {age_days} days)...", file=sys.stderr)
        client.images.pull(container_name)
    else:
        print(f"{container_name} image is up to date (age: {age_days} days)", file=sys.stderr)


if __name__ == "__main__":
    pull_latest_ish()
