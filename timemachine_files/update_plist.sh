#!/bin/bash

set -e

MY_DIR="$(dirname "${0}")"
DEST_FILE="$HOME/Library/LaunchAgents/TimeMachineEject.plist"
SRC_FILE="${MY_DIR}/TimeMachineEject.plist"

echo "Copying ${SRC_FILE} to ${DEST_FILE}"
cp "${SRC_FILE}" "${DEST_FILE}"

echo "Unloading plist file..."
launchctl unload "${DEST_FILE}"
echo "Loading new plist file..."
launchctl load "${DEST_FILE}"
echo "Done!"
