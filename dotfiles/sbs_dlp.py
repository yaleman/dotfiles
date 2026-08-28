"""Helpers for extracting SBS On Demand episode metadata from series pages."""

from __future__ import annotations

import json
import subprocess
import sys
from dataclasses import asdict, dataclass
from enum import Enum
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

import click
import requests
from loguru import logger

JSON_PREFIX = '.streamController.enqueue("'
JSON_SUFFIX = '\\n");</script>'
CACHE_DIR = Path.home() / ".cache" / "sbs-dlp"
PLAYBACK_YT_DLP_SOURCE = "git+https://github.com/0xvd/yt-dlp-exp@ee4f1076e61969c8df41a480269e10dee5d82cbd"
YTDLP_PLUGIN_DIR = Path(__file__).parents[1] / "yt-dlp-plugins"


class DownloadHandler(Enum):
    LEGACY = "legacy"
    PLAYBACK = "playback"


class ExistingDirectory(click.ParamType):
    name = "directory"

    def convert(
        self,
        value: Any,
        param: click.Parameter | None,
        ctx: click.Context | None,
    ) -> Path:
        directory = Path(str(value)).expanduser()
        if not directory.exists():
            self.fail(f"{directory} does not exist", param, ctx)
        if not directory.is_dir():
            self.fail(f"{directory} is not a directory", param, ctx)
        return directory.resolve()


@dataclass(frozen=True)
class EpisodeMetadata:
    episode_url: str
    mpx_media_id: int
    series_slug: str
    season_slug: str
    episode_slug: str
    season_number: int
    episode_number: int
    title: str


class CacheUrl:
    def __init__(self, url: str) -> None:
        self.url = url
        self.hash = sha256(url.encode()).hexdigest()
        self.cache_dir = CACHE_DIR
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.cache_file = self.cache_dir / self.hash

        if not self.cache_file.exists():
            try:
                response = requests.get(url, timeout=30)
                response.raise_for_status()
                self.cache_file.write_text(response.text, encoding="utf-8")
            except Exception as error:
                logger.error(f"Error fetching URL: {error}")
                raise
        else:
            logger.debug(f"Using cached response for URL: {url}")

    def read_text(self) -> str:
        return self.cache_file.read_text(encoding="utf-8")

    def __str__(self) -> str:
        return self.read_text()


def extract_payload_text(input_text: str) -> str:
    prefix_index = input_text.find(JSON_PREFIX)
    if prefix_index == -1:
        raise ValueError("JSON prefix not found in input text")

    end_script_index = input_text.find(JSON_SUFFIX, prefix_index)
    if end_script_index == -1:
        raise ValueError("End of script tag not found in input text")

    json_string = input_text[prefix_index + len(JSON_PREFIX) : end_script_index]
    return json_string.encode().decode("unicode_escape")


def extract_json(input_text: str) -> list[Any]:
    payload_text = extract_payload_text(input_text)
    try:
        payload = json.loads(payload_text)
    except json.JSONDecodeError as error:
        logger.debug("Failed to parse JSON")
        logger.debug(payload_text)
        raise ValueError("Failed to parse JSON from input text") from error
    if not isinstance(payload, list):
        raise TypeError("Expected the SBS payload to decode to a list")
    return payload


def is_reference(value: Any, payload: list[Any]) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and 0 <= value < len(payload)


def decode_key(payload: list[Any], key: str) -> str:
    if key.startswith("_") and key[1:].isdigit():
        key_index = int(key[1:])
        if 0 <= key_index < len(payload):
            resolved_key = payload[key_index]
            if isinstance(resolved_key, str):
                return resolved_key
    return key


def decode_reference(reference: Any, payload: list[Any], seen: set[int] | None = None) -> Any:
    if not is_reference(reference, payload):
        return reference

    if seen is None:
        seen = set()

    target_index = reference
    if target_index in seen:
        return payload[target_index]

    seen.add(target_index)
    decoded = decode_value(payload[target_index], payload, seen)
    seen.remove(target_index)
    return decoded


def decode_value(value: Any, payload: list[Any], seen: set[int] | None = None) -> Any:
    if seen is None:
        seen = set()

    if isinstance(value, dict):
        decoded_dict: dict[str, Any] = {}
        for key, nested_value in value.items():
            decoded_dict[decode_key(payload, key)] = decode_reference(nested_value, payload, seen)
        return decoded_dict

    if isinstance(value, list):
        return [decode_reference(item, payload, seen) for item in value]

    return value


def decode_node(node: Any, payload: list[Any], seen: set[int] | None = None) -> Any:
    return decode_reference(node, payload, seen)


def find_collection_refs(payload: list[Any], collection_name: str) -> list[int]:
    for index, element in enumerate(payload):
        if element != collection_name:
            continue
        if index + 1 >= len(payload):
            break
        collection_ref = payload[index + 1]
        decoded_collection = decode_node(collection_ref, payload)
        if isinstance(decoded_collection, list):
            return decoded_collection
    raise ValueError(f"{collection_name!r} not found in JSON data")


def decode_seasons(payload: list[Any]) -> list[dict[str, Any]]:
    season_refs = find_collection_refs(payload, "seasons")
    seasons = [decode_node(season_ref, payload) for season_ref in season_refs]
    return [season for season in seasons if isinstance(season, dict)]


def build_episode_url(series_slug: str, season_slug: str, episode_slug: str, mpx_media_id: int) -> str:
    return f"https://www.sbs.com.au/ondemand/tv-series/{series_slug}/{season_slug}/{episode_slug}/{mpx_media_id}"


def build_watch_url(mpx_media_id: int) -> str:
    return f"https://www.sbs.com.au/ondemand/watch/{mpx_media_id}"


def season_slug_for(season: dict[str, Any], episode: dict[str, Any]) -> str:
    season_slug = season.get("slug") or episode.get("seasonSlug")
    if isinstance(season_slug, str) and season_slug:
        return season_slug
    return f"season-{int(episode['seasonNumber'])}"


def episode_metadata(episode: dict[str, Any], season: dict[str, Any]) -> EpisodeMetadata:
    season_slug = season_slug_for(season, episode)
    season_number = int(episode["seasonNumber"])
    episode_number = int(episode["episodeNumber"])
    mpx_media_id = int(episode["mpxMediaID"])
    series_slug = str(episode["seriesSlug"])
    episode_slug = str(episode["slug"])
    return EpisodeMetadata(
        episode_url=build_episode_url(series_slug, season_slug, episode_slug, mpx_media_id),
        mpx_media_id=mpx_media_id,
        series_slug=series_slug,
        season_slug=season_slug,
        episode_slug=episode_slug,
        season_number=season_number,
        episode_number=episode_number,
        title=str(episode["title"]),
    )


def extract_episode_metadata(payload: list[Any]) -> list[EpisodeMetadata]:
    episodes: list[EpisodeMetadata] = []
    for season in decode_seasons(payload):
        season_episodes = season.get("episodes", [])
        if not isinstance(season_episodes, list):
            continue
        for episode in season_episodes:
            if not isinstance(episode, dict):
                continue
            episodes.append(episode_metadata(episode, season))
    return episodes


def render_output(episodes: list[EpisodeMetadata], as_json: bool) -> str:
    if as_json:
        return json.dumps([asdict(episode) for episode in episodes], indent=2)
    return "\n".join(episode.episode_url for episode in episodes)


def yt_dlp_command(
    episodes: list[EpisodeMetadata],
    subs: bool = False,
    handler: DownloadHandler = DownloadHandler.LEGACY,
    netrc_location: Path | None = None,
    cookies_from_browser: str | None = None,
    output_dir: Path | None = None,
) -> list[str]:
    subtitle_args = ["--all-subs"] if subs else []
    cookie_args = ["--cookies-from-browser", cookies_from_browser] if cookies_from_browser else []
    output_args = ["--paths", str(output_dir)] if output_dir else []
    error_args = ["--abort-on-error"]
    if handler is DownloadHandler.LEGACY:
        return [
            "uvx",
            "yt-dlp",
            *error_args,
            *cookie_args,
            *output_args,
            *subtitle_args,
            *(episode.episode_url for episode in episodes),
        ]

    authentication_args = ["--netrc", "--netrc-location", str(netrc_location)] if netrc_location else []
    return [
        "uvx",
        "--from",
        PLAYBACK_YT_DLP_SOURCE,
        "yt-dlp",
        "--plugin-dirs",
        str(YTDLP_PLUGIN_DIR),
        *error_args,
        *authentication_args,
        *cookie_args,
        *output_args,
        *subtitle_args,
        *(build_watch_url(episode.mpx_media_id) for episode in episodes),
    ]


def run_yt_dlp(command: list[str]) -> None:
    logger.info(f"Running {' '.join(command)}")
    try:
        subprocess.run(command, check=True)
    except subprocess.CalledProcessError as error:
        raise click.ClickException(f"yt-dlp exited with status {error.returncode}") from error


def download_episodes(
    episodes: list[EpisodeMetadata],
    subs: bool = False,
    handler: DownloadHandler = DownloadHandler.LEGACY,
    login: bool = False,
    cookies_from_browser: str | None = None,
    output_dir: Path | None = None,
) -> None:
    if not login:
        run_yt_dlp(
            yt_dlp_command(
                episodes,
                subs=subs,
                handler=handler,
                cookies_from_browser=cookies_from_browser,
                output_dir=output_dir,
            )
        )
        return

    if handler is DownloadHandler.LEGACY:
        raise click.UsageError("--login is only supported by the playback handler")

    username = click.prompt("SBS email")
    password = click.prompt("SBS password", hide_input=True)
    with TemporaryDirectory(prefix="sbs-dlp-") as temporary_directory:
        netrc_path = Path(temporary_directory) / "netrc"
        netrc_path.write_text(
            f"machine sbs login {json.dumps(username)} password {json.dumps(password)}\n",
            encoding="utf-8",
        )
        netrc_path.chmod(0o600)
        run_yt_dlp(
            yt_dlp_command(
                episodes,
                subs=subs,
                handler=handler,
                netrc_location=netrc_path,
                cookies_from_browser=cookies_from_browser,
                output_dir=output_dir,
            )
        )


@click.command()
@click.argument("url")
@click.option("--json", "as_json", is_flag=True, help="Emit structured episode metadata as JSON")
@click.option("--download", is_flag=True, help="Pass extracted episode URLs to yt-dlp")
@click.option("--subs", is_flag=True, help="Pass --all-subs to yt-dlp when downloading")
@click.option("--cookies-from-browser", metavar="BROWSER", help="Pass browser cookies to yt-dlp")
@click.option("--output-dir", type=ExistingDirectory(), help="Write downloads to an existing directory")
@click.option(
    "--handler",
    type=click.Choice([handler.value for handler in DownloadHandler], case_sensitive=False),
    default=DownloadHandler.PLAYBACK.value,
    show_default=True,
    help="Select the SBS URL/download implementation",
)
@click.option("--login", is_flag=True, help="Prompt for SBS credentials for the playback handler")
@click.option("--debug", is_flag=True, help="Enable debug logging")
def main(
    url: str,
    as_json: bool,
    download: bool,
    subs: bool,
    cookies_from_browser: str | None,
    output_dir: Path | None,
    handler: str,
    login: bool,
    debug: bool,
) -> None:
    logger.remove()
    logger.add(sys.stderr, level="DEBUG" if debug else "INFO")

    response = CacheUrl(url)
    payload = extract_json(response.read_text())
    episodes = extract_episode_metadata(payload)

    if not episodes:
        logger.error("No episodes found in decoded SBS payload")
        raise SystemExit(1)

    if download:
        download_episodes(
            episodes,
            subs=subs,
            handler=DownloadHandler(handler),
            login=login,
            cookies_from_browser=cookies_from_browser,
            output_dir=output_dir,
        )
        return

    click.echo(render_output(episodes, as_json))


__all__ = [
    "CACHE_DIR",
    "YTDLP_PLUGIN_DIR",
    "CacheUrl",
    "DownloadHandler",
    "EpisodeMetadata",
    "ExistingDirectory",
    "build_episode_url",
    "build_watch_url",
    "decode_key",
    "decode_node",
    "decode_reference",
    "decode_seasons",
    "decode_value",
    "download_episodes",
    "extract_episode_metadata",
    "extract_json",
    "extract_payload_text",
    "find_collection_refs",
    "main",
    "render_output",
    "run_yt_dlp",
    "season_slug_for",
    "yt_dlp_command",
]
