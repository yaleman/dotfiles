"""Build the saved 23 October 2026 Japan weather calendar snapshot."""

import json
import sys
from datetime import date, timedelta
from enum import StrEnum
from pathlib import Path
from typing import TypedDict, cast

from fetch_normals import StationNormals

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "output"


class WeatherKind(StrEnum):
    FORECAST = "Forecast"
    SEASONAL_AVERAGE = "Seasonal average"


class WeatherDay(TypedDict):
    date: str
    place: str
    high: int
    low: int
    kind: WeatherKind
    detail: str
    station: str
    url: str


def escape_ics(value: str) -> str:
    return value.replace("\\", "\\\\").replace("\n", "\\n").replace(";", "\\;").replace(",", "\\,")


def fold_ics(line: str) -> str:
    chunks = []
    current = ""
    for char in line:
        if len((current + char).encode()) > 73:
            chunks.append(current)
            current = " "
        current += char
    return "\r\n".join(chunks + [current])


def build_calendar() -> None:
    OUTPUT.mkdir(exist_ok=True)
    forecasts = [
        ("2026-10-28", "Narita", 21, 11, "Sunshine; less humid."),
        ("2026-10-29", "Narita", 18, 12, "Considerable cloudiness."),
        ("2026-10-30", "Utsunomiya", 17, 12, "A little morning rain; mostly cloudy."),
        ("2026-10-31", "Nikko town", 19, 6, "Mostly cloudy; a touch of rain."),
        ("2026-11-01", "Nikko town", 15, 6, "An isolated morning shower; mostly cloudy."),
    ]
    events: list[WeatherDay] = [
        WeatherDay(
            date=d,
            place=p,
            high=h,
            low=l,
            kind=WeatherKind.FORECAST,
            detail=t,
            station="Weather service forecast",
            url="",
        )
        for d, p, h, l, t in forecasts
    ]
    notes = {
        "Kinugawa Onsen": "Imaichi station proxy. Ryokan check-in: 16:00. Actual conditions may differ in the valley.",
        "Minamiaizu": "Tajima station proxy. Colder conditions are possible at higher elevations.",
        "Higashiyama Onsen": "Wakamatsu station proxy; the onsen valley may be cooler.",
        "Onogawa Onsen": "Yonezawa station proxy; the onsen may be cooler.",
        "Iwaki": "Onahama coastal station proxy; inland Iwaki may be cooler at night.",
        "Kisarazu / Kimitsu": "Kisarazu station proxy; inland Kimitsu may be cooler.",
        "Chiba / Izumi": "Chiba city station proxy. Exact Izumi location is unspecified; inland locations may be cooler.",
    }
    for station in cast(list[StationNormals], json.loads((ROOT / "normals.json").read_text(encoding="utf-8"))):
        for day, cells in station["days"].items():
            events.append(
                WeatherDay(
                    date=f"2026-11-{int(day):02}",
                    place=station["name"],
                    high=round(float(cells[3])),
                    low=round(float(cells[4])),
                    kind=WeatherKind.SEASONAL_AVERAGE,
                    detail=notes.get(station["name"], "Local JMA station seasonal average."),
                    station=station["station"].split("（")[0],
                    url=station["url"],
                )
            )
    events.sort(key=lambda e: e["date"])
    expected_dates = [(date(2026, 10, 28) + timedelta(days=i)).isoformat() for i in range(22)]
    if [event["date"] for event in events] != expected_dates:
        raise ValueError("Expected exactly one weather entry for every date from 28 October through 18 November")
    events[-1]["detail"] += " Check-out / final itinerary day; no overnight stay supplied."
    (OUTPUT / "weather-days.json").write_text(json.dumps(events, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    template = (ROOT / "calendar-template.html").read_text(encoding="utf-8")
    target = OUTPUT / "japan-weather-calendar.html"
    target.write_text(template.replace("DATA_PLACEHOLDER", json.dumps(events, ensure_ascii=False)), encoding="utf-8")
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Travel//Japan Weather Calendar//EN",
        "CALSCALE:GREGORIAN",
        "X-WR-CALNAME:Japan weather — October–November 2026",
        "X-WR-TIMEZONE:Asia/Tokyo",
    ]
    for event in events:
        start = date.fromisoformat(event["date"])
        description = (
            f"{event['kind']}: high {event['high']}°C / low {event['low']}°C.\n"
            f"{event['detail']}\nSource: {event['station']}.\n"
            "Prepared 23 October 2026. Seasonal averages are historical expectations, not forecasts. "
            "Snapshot only; does not update automatically.\n" + event["url"]
        )
        lines += [
            "BEGIN:VEVENT",
            f"UID:japan-weather-{start.isoformat()}@travel.local",
            "DTSTAMP:20261023T000000Z",
            f"DTSTART;VALUE=DATE:{start:%Y%m%d}",
            f"DTEND;VALUE=DATE:{start + timedelta(days=1):%Y%m%d}",
            "SUMMARY:" + escape_ics(f"{event['place']} — {event['high']}° / {event['low']}°C ({event['kind']})"),
            "LOCATION:" + escape_ics(event["place"] + ", Japan"),
            "DESCRIPTION:" + escape_ics(description),
            "TRANSP:TRANSPARENT",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    (OUTPUT / "japan-weather-calendar.ics").write_bytes(("\r\n".join(map(fold_ics, lines)) + "\r\n").encode())
    print(f"Created {len(events)} daily entries and calendar snapshot.")


def main() -> int:
    try:
        build_calendar()
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"Could not build weather calendar: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
