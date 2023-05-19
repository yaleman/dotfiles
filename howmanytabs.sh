#!/bin/bash

set -e

function safariTabs () {
    #shellcheck disable=SC2069
    osascript howmanytabsraw 2>&1 >/dev/null
}


#shellcheck disable=SC2069
safariTabs 2>&1 >/dev/null

if [ "$(ps aux | rg -c 'Microsoft Edge\.app')" -gt 1 ]; then
    # TODO: finish using chrome-cli to do chrome/edge tabs
    export CHROME_BUNDLE_IDENTIFIER="com.microsoft.edgemac"

    # TABS=$(chrome-cli list tabs | wc -l)
    # WINDOWS=$(chrome-cli list windows | wc -l)

    # curl -sf https://$()
fi
