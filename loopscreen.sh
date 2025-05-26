#!/bin/bash

# This loops the screen command for pesky serial devices which keep disappearing

if [ -z "$1" ]; then
    echo "Specify a target device"
    exit 1
fi

while true; do
    if [ "$(find dirname "${1}" -name "$(basename "${1}")" | wc -l)" -eq 1 ]; then
        screen "${1}"
    else
        sleep 1
    fi
done
