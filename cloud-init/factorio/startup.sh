#!/bin/bash

if [ -z "$1" ]; then
    echo "Usage: $0 <savefile>"
    exit 1
fi

sudo cp /Users/yaleman/Library/Application\ Support/factorio/mods/*.zip mods/

sudo /opt/factorio/bin/x64/factorio \
    --server-settings /opt/factorio/server-settings.json  \
    --bind 0.0.0.0:34197    \
    --rcon-bind 0.0.0.0:27015   \
    --rcon-password password123    \
    --server-adminlist /opt/factorio/server-adminlist.json   \
    --start-server "$1"