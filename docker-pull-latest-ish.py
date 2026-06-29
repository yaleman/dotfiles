#!/usr/bin/env python3


import json
from typing import Optional, Dict
from pathlib import Path
import os
import sys
from datetime import datetime, timezone
import docker
import docker.errors
import click

HOMEDIR = os.path.expanduser("~/.cache/docker-pull-latest-ish")
CACHE_PATH = Path(os.path.join(HOMEDIR, "cache.json"))

CacheType = Dict[str, float]


class Cache:
    """caches the results"""

    def __init__(self):
        self.cache: CacheType = {}
        self.get_cache()
        self.changed = False

    def get_cache(self) -> CacheType:
        if not CACHE_PATH.exists():
            return {}
        with open(CACHE_PATH, "r") as f:
            self.cache: CacheType = json.load(f)
        return self.cache

    def write_cache(self) -> None:
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(CACHE_PATH, "w") as f:
            json.dump(self.cache, f)

    def get(self, container_name: str) -> Optional[float]:
        res = self.cache.get(container_name)
        if not isinstance(res, (float, int)):
            return None
        return float(res)

    def set(self, container_name: str, created_time: float | int) -> None:
        self.cache[container_name] = float(created_time)
        self.changed = True

    def __del__(self):
        if self.changed:
            self.write_cache()


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

    cache = Cache()
    cached_created_time = cache.get(container_name)
    if cached_created_time is not None:
        if float(cached_created_time) >= float(created_dt.timestamp()):
            print(f"{container_name} image is up to date (cached)", file=sys.stderr)
            return
    else:
        cache.set(container_name, created_dt.timestamp())
    now_dt = datetime.now(timezone.utc)
    age_days = (now_dt - created_dt).days

    if age_days > days:
        print(f"Updating {container_name} image (age: {age_days} days)...", file=sys.stderr)
        client.images.pull(container_name)
    else:
        print(f"{container_name} image is up to date (age: {age_days} days)", file=sys.stderr)
    cache.set(container_name, created_dt.timestamp())


if __name__ == "__main__":
    pull_latest_ish()
