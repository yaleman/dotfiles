#!/bin/bash

if [ -z "$1" ]; then
    echo "Usage: $0 <process_name>"
    exit 1
fi

if ! command -v ps &> /dev/null; then
    echo "ps command not found. Please install it."
    exit 1
fi

PID=$(pgrep "$1")
if [ -z "$PID" ]; then
    echo "No process found matching: $1"
    exit 1
fi

LOGFILE="ps-stats.txt"
INTERVAL=60  # seconds between samples

while true; do
    ps -l -p "$PID" | tail -n1 | tee -a "$LOGFILE"
    sleep $INTERVAL
done

