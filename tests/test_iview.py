import json
from pathlib import Path

import pytest
from click.testing import CliRunner

from dotfiles import sbs_dlp
from dotfiles.iview import extract_iview_document

SHOW_URL = "https://iview.abc.net.au/show/state-of-man"
VIDEO_ID = "DO2559H002S00"
VIDEO_URL = f"https://iview.abc.net.au/video/{VIDEO_ID}"


def show_html(series_id: str = "1", video_id: str = VIDEO_ID) -> str:
    document = {
        "selectedSeries": {
            "id": series_id,
            "episodes": {"items": [{"id": video_id, "title": "The State Of Man", "subtitle": "Episode 2 — café"}]},
        },
        "seriesList": [
            {"id": "1", "links": {"deeplink": "/show/state-of-man/series/1"}},
            {"id": "2", "links": {"deeplink": "/show/state-of-man/series/2"}},
        ],
    }
    stream = "18:" + json.dumps(["$", "component", None, {"document": document}], ensure_ascii=False) + "\n"
    # Real pages may divide a record between script chunks.
    return "".join(
        f"<script>self.__next_f.push({json.dumps([1, chunk])})</script>" for chunk in (stream[:70], stream[70:])
    )


@pytest.fixture
def cached_pages(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    fetched: list[str] = []

    class FakeCache:
        def __init__(self, url: str) -> None:
            self.url = url
            fetched.append(url)

        def read_text(self) -> str:
            if "/api/programs/" in self.url:
                return json.dumps(
                    {
                        "href": f"programs/state-of-man/{VIDEO_ID}",
                        "seriesTitle": "The State Of Man",
                        "title": "Series 1 Ep 2",
                    }
                )
            if self.url.endswith("/2"):
                return show_html("2", "DO2559H003S00")
            return show_html()

    monkeypatch.setattr(sbs_dlp, "CacheUrl", FakeCache)
    return fetched


def test_show_lists_all_series_and_preserves_unicode(cached_pages: list[str]) -> None:
    result = CliRunner().invoke(sbs_dlp.main, ["--json", SHOW_URL])
    assert result.exit_code == 0, result.output
    data = json.loads(result.output)
    assert [episode["video_id"] for episode in data] == [VIDEO_ID, "DO2559H003S00"]
    assert data[0]["title"] == "The State Of Man - Episode 2 — café"
    assert cached_pages == [SHOW_URL, SHOW_URL + "/series/2"]


def test_explicit_series_only_lists_that_series(cached_pages: list[str]) -> None:
    result = CliRunner().invoke(sbs_dlp.main, [SHOW_URL + "/series/1/?test=1"])
    assert result.exit_code == 0, result.output
    assert result.output.strip() == VIDEO_URL
    assert len(cached_pages) == 1


def test_single_video_metadata(cached_pages: list[str]) -> None:
    result = CliRunner().invoke(sbs_dlp.main, ["--json", VIDEO_URL])
    assert result.exit_code == 0, result.output
    assert json.loads(result.output)[0] == {
        "episode_url": VIDEO_URL,
        "video_id": VIDEO_ID,
        "series_slug": "state-of-man",
        "title": "The State Of Man - Series 1 Ep 2",
    }
    assert cached_pages == [f"https://iview.abc.net.au/api/programs/{VIDEO_ID}"]


@pytest.mark.parametrize("handler", ["legacy", "playback"])
def test_download_uses_abc_urls_and_options(
    cached_pages: list[str],
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    handler: str,
) -> None:
    calls: list[list[str]] = []
    monkeypatch.setattr(sbs_dlp, "run_yt_dlp", calls.append)
    result = CliRunner().invoke(
        sbs_dlp.main,
        [
            "--download",
            "--handler",
            handler,
            "--subs",
            "--cookies-from-browser",
            "firefox",
            "--output-dir",
            str(tmp_path),
            SHOW_URL,
        ],
    )
    assert result.exit_code == 0, result.output
    assert calls == [
        [
            "uvx",
            "yt-dlp",
            "--abort-on-error",
            "--cookies-from-browser",
            "firefox",
            "--paths",
            str(tmp_path),
            "--all-subs",
            VIDEO_URL,
            "https://iview.abc.net.au/video/DO2559H003S00",
        ]
    ]


def test_login_rejected_without_prompt(cached_pages: list[str]) -> None:
    result = CliRunner().invoke(sbs_dlp.main, ["--download", "--login", SHOW_URL])
    assert result.exit_code == 2
    assert "--cookies-from-browser" in result.output
    assert "SBS email" not in result.output


def test_missing_show_data_is_reported() -> None:
    with pytest.raises(ValueError, match="No ABC iview show listing"):
        extract_iview_document("<html></html>")
