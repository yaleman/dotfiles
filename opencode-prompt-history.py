#!/usr/bin/env python3
"""Monitor opencode prompt-history.jsonl and forward new lines to Splunk HEC."""

import hashlib
import json
import os
import sys
import time
from pathlib import Path

import requests

HISTORY_FILE = Path.home() / ".local" / "state" / "opencode" / "prompt-history.jsonl"
HASH_FILE = Path.home() / ".local" / "cache" / "opencode-prompt-history-hashes.jsonl"
SPLUNK_HEC_URL = os.environ.get("SPLUNK_HEC_URL", "")
SPLUNK_HEC_TOKEN = os.environ.get("SPLUNK_HEC_TOKEN", "")
SPLUNK_INDEX = os.environ.get("SPLUNK_INDEX", "monitoring")
SPLUNK_SOURCETYPE = os.environ.get("SPLUNK_SOURCETYPE", "opencode:prompt")
POLL_INTERVAL = float(os.environ.get("POLL_INTERVAL", "60.0"))
HASH_TTL_DAYS = 30


def line_hash(line: str) -> str:
    return hashlib.sha256(line.encode("utf-8")).hexdigest()


def load_hashes() -> set[str]:
    hashes: set[str] = set()
    if not HASH_FILE.exists():
        return hashes
    cutoff = time.time() - (HASH_TTL_DAYS * 86400)
    with open(HASH_FILE, "r", encoding="utf-8") as f:
        for entry in f:
            entry = entry.strip()
            if not entry:
                continue
            try:
                record = json.loads(entry)
                ts = record.get("ts", 0)
                if ts >= cutoff:
                    hashes.add(record["h"])
            except (json.JSONDecodeError, KeyError):
                continue
    return hashes


def save_hash(h: str) -> None:
    HASH_FILE.parent.mkdir(parents=True, exist_ok=True)
    record = json.dumps({"h": h, "ts": time.time()})
    with open(HASH_FILE, "a", encoding="utf-8") as f:
        f.write(record + "\n")


def send_to_splunk(url: str, token: str, index: str, sourcetype: str, event: object) -> bool:
    payload = {
        "index": index,
        "sourcetype": sourcetype,
        "event": event,
    }
    headers = {
        "Authorization": f"Splunk {token}",
        "Content-Type": "application/json",
    }
    try:
        resp = requests.post(f"{url.rstrip('/')}/services/collector/event", json=payload, headers=headers, timeout=10)
        print(".", end="", flush=True)
        return resp.status_code == 200
    except requests.RequestException as e:
        print(f"splunk send error: {e}", file=sys.stderr)
        return False


def validate_env() -> bool:
    if not SPLUNK_HEC_URL:
        print("SPLUNK_HEC_URL is required", file=sys.stderr)
        return False
    if not SPLUNK_HEC_TOKEN:
        print("SPLUNK_HEC_TOKEN is required", file=sys.stderr)
        return False
    return True


def tail_file(filepath: Path, seen_hashes: set[str]) -> list[str]:
    if not filepath.exists():
        return []
    new_lines: list[str] = []
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            stripped = line.strip()
            if not stripped:
                continue
            h = line_hash(stripped)
            if h not in seen_hashes:
                seen_hashes.add(h)
                new_lines.append(stripped)
    return new_lines


def main() -> None:
    if not validate_env():
        sys.exit(1)

    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)

    seen_hashes = load_hashes()
    print(f"loaded {len(seen_hashes)} hashes from {HASH_FILE}", file=sys.stderr)

    print(f"loading existing history from {HISTORY_FILE}...", file=sys.stderr)

    print(f"monitoring {HISTORY_FILE} for new lines...", file=sys.stderr)
    while True:
        new_lines = tail_file(HISTORY_FILE, seen_hashes)
        for line in new_lines:
            h = line_hash(line)
            save_hash(h)
            try:
                event: dict[str, str] = json.loads(line)
            except json.JSONDecodeError:
                event = {"raw": line}
            ok = send_to_splunk(SPLUNK_HEC_URL, SPLUNK_HEC_TOKEN, SPLUNK_INDEX, SPLUNK_SOURCETYPE, event)
            if not ok:
                print(f"failed to send: {line[:120]}", file=sys.stderr)
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
