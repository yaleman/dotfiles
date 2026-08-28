"""Authenticate SBS's playback API from a browser refresh-token cookie."""

from importlib import import_module
from typing import Any

_SBSIE: Any = import_module("yt_dlp.extractor.sbs").SBSIE


class _SBSCookieAuthIE(_SBSIE, plugin_name="cookie-auth"):
    def _real_initialize(self) -> None:
        for cookie_url in ("https://sbs.com.au", "https://www.sbs.com.au", "https://auth.sbs.com.au"):
            refresh_cookie = self._get_cookies(cookie_url).get(self._REFRESH_COOKIE)
            if refresh_cookie:
                self._REFRESH_TOKEN = refresh_cookie.value
                self._refresh_access_token()
                return

        if not self._parse_and_cache_login_response():
            self.report_warning("No SBS auth.refresh-token was found in the supplied browser cookies")
