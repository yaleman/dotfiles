# Japan weather calendar

Scripts for the 28 October–18 November 2026 itinerary. Uses Python 3.12+;
no additional dependencies are required.

`fetch_normals.py` refreshes `normals.json` from JMA's daily climate normals.
It checks every requested station and date before replacing the saved data.
Nearby station proxies are identified in the calendar details.

`build_calendar.py` combines that data with the **23 October 2026 forecast
snapshot** for 28 October–1 November. Those five forecasts are stored in the
script and are **not refreshed** by fetching JMA normals. Later dates are
historical seasonal averages, not daily forecasts or severe-weather warnings.
The generated calendar retains the original snapshot date.

Run from the repository root:

```sh
uv run python japan-weather/fetch_normals.py
uv run python japan-weather/build_calendar.py
```

To reproduce the saved snapshot without network access, run only the second
command. Both scripts resolve paths from their own directory, so they also work
from another working directory.

The builder writes these files under `japan-weather/output/`:

- `japan-weather-calendar.ics`: importable all-day calendar entries, high/low
  temperatures in °C, forecast/average labels, station notes and source URLs.
- `japan-weather-calendar.html`: an inline visualization fragment for Codex,
  using `calendar-template.html` and the host's styles; not a standalone webpage.
- `weather-days.json`: the combined daily data.

The itinerary assigns transfer days to the destination and includes 18 November
as the final check-out day. Onogawa is near Yonezawa; Higashiyama is in
Aizuwakamatsu. “Chiba / Izumi” uses Chiba city as a proxy because the exact
Izumi location was not specified.

Neither these scripts nor the imported calendar monitor live weather. The
scheduled snow/severe-weather watch is managed separately in the travel chat.
