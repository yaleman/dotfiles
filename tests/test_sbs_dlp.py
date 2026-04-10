import json
from pathlib import Path

from click.testing import CliRunner
import pytest

from dotfiles import sbs_dlp

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "sbs_dlp"
FIXTURE_URLS = {
    "shoresy": "https://www.sbs.com.au/ondemand/tv-series/shoresy",
    "catch_22": "https://www.sbs.com.au/ondemand/tv-series/catch-22",
    "once_upon_a_time_in_space": "https://www.sbs.com.au/ondemand/tv-series/once-upon-a-time-in-space",
}


def load_payload(name: str) -> list[object]:
    return json.loads((FIXTURE_DIR / f"{name}.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize(
    ("name", "expected_seasons", "expected_episodes"),
    [
        ("shoresy", 5, 30),
        ("catch_22", 1, 6),
        ("once_upon_a_time_in_space", 1, 4),
    ],
)
def test_decode_seasons_and_episode_counts(name: str, expected_seasons: int, expected_episodes: int) -> None:
    payload = load_payload(name)

    seasons = sbs_dlp.decode_seasons(payload)
    episodes = sbs_dlp.extract_episode_metadata(payload)

    assert len(seasons) == expected_seasons
    assert len(episodes) == expected_episodes
    assert all("seasonNumber" in season for season in seasons)
    assert all("episodes" in season for season in seasons)


@pytest.mark.parametrize("name", ["shoresy", "catch_22", "once_upon_a_time_in_space"])
def test_episode_metadata_contains_stable_fields(name: str) -> None:
    payload = load_payload(name)

    episode = sbs_dlp.extract_episode_metadata(payload)[0]

    assert episode.series_slug
    assert episode.season_slug
    assert episode.episode_slug
    assert episode.mpx_media_id > 0
    assert episode.season_number > 0
    assert episode.episode_number > 0
    assert episode.title


def test_catch_22_regression_uses_decoded_field_names() -> None:
    payload = load_payload("catch_22")

    seasons = sbs_dlp.decode_seasons(payload)
    first_season = seasons[0]
    first_episode = first_season["episodes"][0]
    first_metadata = sbs_dlp.extract_episode_metadata(payload)[0]

    assert first_season["seasonNumber"] == 1
    assert len(first_season["episodes"]) == 6
    assert first_season["slug"] == "season-1"
    assert first_episode["seriesSlug"] == "catch-22"
    assert first_episode["slug"] == "catch-22-s1-ep1"
    assert first_episode["mpxMediaID"] == 2474793027793
    assert first_metadata.season_slug == "season-1"


@pytest.mark.parametrize(
    ("name", "expected_url"),
    [
        (
            "catch_22",
            "https://www.sbs.com.au/ondemand/tv-series/catch-22/season-1/catch-22-s1-ep1/2474793027793",
        ),
        (
            "once_upon_a_time_in_space",
            "https://www.sbs.com.au/ondemand/tv-series/once-upon-a-time-in-space/season-1/once-upon-a-time-in-space-s1-ep1/2478711363905",
        ),
    ],
)
def test_episode_urls_match_sbs_route_shape(name: str, expected_url: str) -> None:
    payload = load_payload(name)

    episode = sbs_dlp.extract_episode_metadata(payload)[0]

    assert episode.episode_url == expected_url


class FakeCacheUrl:
    def __init__(self, url: str) -> None:
        self.url = url

    def read_text(self) -> str:
        return self.url


@pytest.mark.parametrize("fixture_name", ["catch_22"])
def test_cli_default_output(monkeypatch: pytest.MonkeyPatch, fixture_name: str) -> None:
    payload = load_payload(fixture_name)
    runner = CliRunner()

    monkeypatch.setattr(sbs_dlp, "CacheUrl", FakeCacheUrl)
    monkeypatch.setattr(sbs_dlp, "extract_json", lambda _: payload)

    result = runner.invoke(sbs_dlp.main, [FIXTURE_URLS[fixture_name]])

    assert result.exit_code == 0
    lines = [line for line in result.output.strip().splitlines() if line]
    assert lines[0] == "https://www.sbs.com.au/ondemand/tv-series/catch-22/season-1/catch-22-s1-ep1/2474793027793"
    assert len(lines) == 6


@pytest.mark.parametrize("fixture_name", ["catch_22"])
def test_cli_json_output(monkeypatch: pytest.MonkeyPatch, fixture_name: str) -> None:
    payload = load_payload(fixture_name)
    runner = CliRunner()

    monkeypatch.setattr(sbs_dlp, "CacheUrl", FakeCacheUrl)
    monkeypatch.setattr(sbs_dlp, "extract_json", lambda _: payload)

    result = runner.invoke(sbs_dlp.main, ["--json", FIXTURE_URLS[fixture_name]])

    assert result.exit_code == 0
    data = json.loads(result.output)
    assert data[0] == {
        "episode_url": "https://www.sbs.com.au/ondemand/tv-series/catch-22/season-1/catch-22-s1-ep1/2474793027793",
        "mpx_media_id": 2474793027793,
        "series_slug": "catch-22",
        "season_slug": "season-1",
        "episode_slug": "catch-22-s1-ep1",
        "season_number": 1,
        "episode_number": 1,
        "title": "Episode 1",
    }


def test_cli_download_passes_urls_to_yt_dlp(monkeypatch: pytest.MonkeyPatch) -> None:
    payload = load_payload("catch_22")
    runner = CliRunner()
    calls: list[tuple[list[str], bool]] = []

    monkeypatch.setattr(sbs_dlp, "CacheUrl", FakeCacheUrl)
    monkeypatch.setattr(sbs_dlp, "extract_json", lambda _: payload)

    def fake_run(command: list[str], check: bool) -> None:
        calls.append((command, check))

    monkeypatch.setattr(sbs_dlp.subprocess, "run", fake_run)

    result = runner.invoke(sbs_dlp.main, ["--download", FIXTURE_URLS["catch_22"]])

    assert result.exit_code == 0
    assert "Running uvx yt-dlp" in result.output
    assert calls == [
        (
            [
                "uvx",
                "yt-dlp",
                "https://www.sbs.com.au/ondemand/tv-series/catch-22/season-1/catch-22-s1-ep1/2474793027793",
                "https://www.sbs.com.au/ondemand/tv-series/catch-22/season-1/catch-22-s1-ep2/2474793027794",
                "https://www.sbs.com.au/ondemand/tv-series/catch-22/season-1/catch-22-s1-ep3/2474793027795",
                "https://www.sbs.com.au/ondemand/tv-series/catch-22/season-1/catch-22-s1-ep4/2474793027796",
                "https://www.sbs.com.au/ondemand/tv-series/catch-22/season-1/catch-22-s1-ep5/2474793027797",
                "https://www.sbs.com.au/ondemand/tv-series/catch-22/season-1/catch-22-s1-ep6/2474793027798",
            ],
            True,
        )
    ]
