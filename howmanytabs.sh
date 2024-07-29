#!/bin/bash

set -e

if [ -z "${DEBUG}" ]; then
    DEBUG=0
fi

function safariTabs () {
    MYDIR="$(dirname "$0")"

    if [ ! -f "${MYDIR}/howmanytabsraw" ]; then
        if [ "${DEBUG}" -eq 1 ]; then
            echo "Compiling howmanytabsraw"
        fi

        make howmanytabs
    fi


    if [ "${DEBUG}" -eq 1 ]; then
        osascript "${MYDIR}/howmanytabsraw"
    else
        #shellcheck disable=SC2069
        osascript "${MYDIR}/howmanytabsraw" 2>&1 >/dev/null
    fi
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
    HOSTNAME="$(hostname -s)"
    if [ "${DEBUG}" -eq 1 ]; then
        CURL_SILENT="-v"
        LOG_DEST="/dev/stdout"
    else
        CURL_SILENT="-s"
        LOG_DEST="/dev/null"
    fi
    if [ "${DEBUG}" -eq 1 ]; then
        echo "Edge Data: ${DATA}"
        echo "Sending to ${HEC_HOST}"
        echo "I am ${HOSTNAME}"
    fi

    curl ${CURL_SILENT} -f "https://${HEC_HOST}:${HEC_PORT}/services/collector/raw?host=${HOSTNAME}&sourcetype=tabcounter" \
        -H "${AUTH_HEADER}" \
        -d "${DATA}" > "${LOG_DEST}"
else
    if [ "${DEBUG}" -eq 1 ]; then
        echo "Edge not running"
    fi
fi
