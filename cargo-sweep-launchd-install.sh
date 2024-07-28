#!/bin/bash

export SWEEP_DIR="${HOME}/Projects"

PLIST_FILENAME="cargo-sweep.plist"
LAUNCHD_FILE="$HOME/Library/LaunchAgents/${PLIST_FILENAME}"

envsubst < cargo-sweep.plist > "${TMPDIR}/${PLIST_FILENAME}"

if [ ! -f "${LAUNCHD_FILE}" ]; then
    cp "${TMPDIR}/${PLIST_FILENAME}" "${LAUNCHD_FILE}"
    echo "Created ${LAUNCHD_FILE}"
    launchctl load "${LAUNCHD_FILE}"
    exit 0
fi

DIFF="$(diff "${TMPDIR}/${PLIST_FILENAME}" "${LAUNCHD_FILE}")"

if [ -n "${DIFF}" ]; then
    cp "${TMPDIR}/${PLIST_FILENAME}" "${LAUNCHD_FILE}"
    echo "Updated ${LAUNCHD_FILE}"
    echo "${DIFF}"
    launchctl unload "${LAUNCHD_FILE}"
    launchctl load "${LAUNCHD_FILE}"
    exit 0
else
    echo "No changes to be made!"
fi