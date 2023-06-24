#!/bin/bash

set -e



function safariTabs () {
    MYDIR="$(dirname "$0")"

    #shellcheck disable=SC2069
    osascript "${MYDIR}/howmanytabsraw" 2>&1 >/dev/null
}


#shellcheck disable=SC2069
safariTabs 2>&1 > /dev/null

if [ "$(ps aux | /opt/homebrew/bin/rg 'Microsoft Edge\.app' | wc -l)" -gt 1 ]; then
    export CHROME_BUNDLE_IDENTIFIER="com.microsoft.edgemac"

    # https://github.com/prasmussen/chrome-cli

    TABS=$(/opt/homebrew/bin/chrome-cli list tabs | wc -l)
    WINDOWS=$(/opt/homebrew/bin/chrome-cli list windows | wc -l)
    HEC_HOST="$(plutil -extract hecHost raw -expect string ~/.config/howmanytabs.plist)"
    HEC_TOKEN="$(plutil -extract hecToken raw -expect string ~/.config/howmanytabs.plist)"
    HEC_PORT="$(plutil -extract hecPort raw -expect string ~/.config/howmanytabs.plist)"

    DATA="{\"browser\" : \"chrome\", \"windows\": ${WINDOWS}, \"tabs\": ${TABS}}"
    AUTH_HEADER="Authorization: Splunk ${HEC_TOKEN}"
    curl -sf "https://${HEC_HOST}:${HEC_PORT}/services/collector/raw?host=$(hostname -s)" \
        -H "${AUTH_HEADER}" \
        -d "${DATA}" > /dev/null
fi
