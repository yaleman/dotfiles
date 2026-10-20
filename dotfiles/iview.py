"""Extract ABC iview show listings from the page's Next.js data stream."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit


@dataclass(frozen=True)
class IViewEpisode:
    episode_url: str
    video_id: str
    series_slug: str
    title: str


def iview_path(url: str) -> list[str] | None:
    parsed = urlsplit(url)
    if parsed.scheme in {"http", "https"} and parsed.hostname == "iview.abc.net.au":
        return parsed.path.strip("/").split("/")
    return None


def extract_iview_document(html: str) -> dict[str, Any]:
    chunks = []
    for match in re.finditer(r"self\.__next_f\.push\((.*?)\)</script>", html, re.DOTALL):
        chunk = json.loads(match[1])
        if len(chunk) == 2 and chunk[0] == 1 and isinstance(chunk[1], str):
            chunks.append(chunk[1])
    stream = "".join(chunks)
    for match in re.finditer(r'"document"\s*:\s*', stream):
        document, _ = json.JSONDecoder().raw_decode(stream[match.end() :])
        if isinstance(document, dict) and "selectedSeries" in document:
            return document
    raise ValueError("No ABC iview show listing found on this page")


def iview_episodes(document: dict[str, Any], series_slug: str) -> list[IViewEpisode]:
    return [
        IViewEpisode(
            episode_url=f"https://iview.abc.net.au/video/{episode['id']}",
            video_id=episode["id"],
            series_slug=series_slug,
            title=" - ".join(
                value for value in (episode["title"], episode.get("subtitle")) if value and value != "$undefined"
            ),
        )
        for episode in document["selectedSeries"]["episodes"]["items"]
    ]
