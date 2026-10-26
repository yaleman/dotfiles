"""Fetch JMA daily climate normals for the November 2026 itinerary."""

import concurrent.futures
import html
import json
import re
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import TypedDict

ROOT = Path(__file__).resolve().parent


class StationKind(StrEnum):
    AMEDAS = "amd"
    SURFACE = "sfc"


@dataclass(frozen=True)
class Station:
    name: str
    prefecture: int
    block: str
    kind: StationKind
    days: tuple[int, ...]


class StationNormals(TypedDict):
    name: str
    url: str
    station: str
    days: dict[str, list[str]]


STATIONS = [
    Station("Kinugawa Onsen", 41, "1333", StationKind.AMEDAS, (2,)),
    Station("Minamiaizu", 36, "0303", StationKind.AMEDAS, (3,)),
    Station("Higashiyama Onsen", 36, "47570", StationKind.SURFACE, (4,)),
    Station("Onogawa Onsen", 35, "0279", StationKind.AMEDAS, (5,)),
    Station("Fukushima City", 36, "47595", StationKind.SURFACE, (6, 7)),
    Station("Iwaki", 36, "47598", StationKind.SURFACE, (8,)),
    Station("Hitachi", 40, "1011", StationKind.AMEDAS, (9,)),
    Station("Mito", 40, "47629", StationKind.SURFACE, (10, 11)),
    Station("Choshi", 45, "47648", StationKind.SURFACE, (12,)),
    Station("Katsuura", 45, "47674", StationKind.SURFACE, (13,)),
    Station("Tateyama", 45, "47672", StationKind.SURFACE, (14, 15)),
    Station("Kisarazu / Kimitsu", 45, "0382", StationKind.AMEDAS, (16,)),
    Station("Chiba / Izumi", 45, "47682", StationKind.SURFACE, (17, 18)),
]


def parse_station(raw: str, station: Station, url: str) -> StationNormals:
    title = re.search(r"<h3.*?>(.*?)</h3>", raw, re.DOTALL)
    if title is None:
        raise ValueError(f"Missing JMA station heading for {station.name}")
    result: StationNormals = {
        "name": station.name,
        "url": url,
        "station": html.unescape(re.sub("<[^>]+>", "", title.group(1))).strip(),
        "days": {},
    }
    expected_days = {str(day) for day in station.days}
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", raw, re.DOTALL):
        cells = [
            html.unescape(re.sub("<[^>]+>", "", cell)).strip()
            for cell in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.DOTALL)
        ]
        day = cells[0].removesuffix("日") if cells else ""
        if day in expected_days:
            if len(cells) < 5:
                raise ValueError(f"Incomplete JMA row for {station.name}, November {day}")
            float(cells[3])
            float(cells[4])
            result["days"][day] = cells
    if result["days"].keys() != expected_days:
        raise ValueError(f"Missing JMA dates for {station.name}: {expected_days - result['days'].keys()}")
    return result


def read_station(station: Station) -> StationNormals:
    url = (
        f"https://www.data.jma.go.jp/stats/etrn/view/nml_{station.kind.value}_d.php"
        f"?prec_no={station.prefecture}&block_no={station.block}&year=&month=11&day=&view="
    )
    with urllib.request.urlopen(url, timeout=30) as response:
        raw = response.read().decode("utf-8")
    return parse_station(raw, station, url)


def main() -> int:
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            result = list(pool.map(read_station, STATIONS))
        # Finish every station successfully before replacing the saved snapshot.
        (ROOT / "normals.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except (OSError, ValueError, urllib.error.URLError) as error:
        print(f"Could not refresh JMA normals: {error}", file=sys.stderr)
        return 1
    print(f"Saved JMA normals for {len(result)} stations.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
