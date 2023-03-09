#shellcheck shell=bash
# source this in your shell and you'll get the homebrew-installed curl first

CURL_DIR="$(find /opt/homebrew/Cellar/curl -maxdepth 1 -mindepth 1 -type d | head -n1)"

if [ -z "${CURL_DIR}" ]; then
    echo "Couldn't find curl"
    exit 1
#else
#    echo "Found curl dir: ${CURL_DIR}"
fi

PATH="${CURL_DIR}/bin:$PATH"
