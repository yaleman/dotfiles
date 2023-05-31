#!/bin/bash

set -e

function safariTabs () {
    #shellcheck disable=SC2069
    osascript howmanytabsraw 2>&1 >/dev/null
}


#shellcheck disable=SC2069
safariTabs 2>&1 > /dev/null

if [ "$(ps aux | rg -c 'Microsoft Edge\.app')" -gt 1 ]; then
    # TODO: finish using chrome-cli to do chrome/edge tabs
    export CHROME_BUNDLE_IDENTIFIER="com.microsoft.edgemac"

    # https://github.com/prasmussen/chrome-cli

    TABS=$(chrome-cli list tabs | wc -l)
    WINDOWS=$(chrome-cli list windows | wc -l)
    HEC_HOST="$(plutil -extract hecHost raw -expect string ~/.config/howmanytabs.plist)"
    HEC_TOKEN="$(plutil -extract hecToken raw -expect string ~/.config/howmanytabs.plist)"
    HEC_PORT="$(plutil -extract hecPort raw -expect string ~/.config/howmanytabs.plist)"

    DATA="{\"browser\" : \"chrome\", \"windows\": ${WINDOWS}, \"tabs\": ${TABS}}"
    AUTH_HEADER="Authorization: Splunk ${HEC_TOKEN}"
    curl -sf "https://${HEC_HOST}:${HEC_PORT}/services/collector/raw?host=$(hostname -s)" \
        -H "${AUTH_HEADER}" \
        -d "${DATA}" > /dev/null
fi
