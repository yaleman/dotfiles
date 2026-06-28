#!/usr/bin/env bash
set -euo pipefail

APPNAME="opencode"
LABEL="com.$APPNAME"
DOMAIN="gui/$(id -u)"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PLIST_SRC="$SCRIPT_DIR/opencode_service/$LABEL.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_DST="$LAUNCH_AGENTS_DIR/$LABEL.plist"

usage() {
    echo "Usage: $0 [--install|--stop|--status|--restart]"
}

status() {
    launchctl print "$DOMAIN/$LABEL"
}

stop() {
    echo "Stopping $APPNAME service..."
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
}

install() {
    echo "Installing $APPNAME service..."

    if [ ! -f "$PLIST_SRC" ]; then
        echo "Missing plist: $PLIST_SRC" >&2
        exit 1
    fi

    plutil -lint "$PLIST_SRC"

    mkdir -p "$LAUNCH_AGENTS_DIR"

    if [ -L "$PLIST_DST" ] || [ -e "$PLIST_DST" ]; then
        rm "$PLIST_DST"
    fi

    echo "Linking plist to $PLIST_DST..."
    ln -s "$PLIST_SRC" "$PLIST_DST"

    stop

    echo "Bootstrapping $APPNAME service..."
    launchctl bootstrap "$DOMAIN" "$PLIST_DST"

    echo "Enabling $APPNAME service..."
    launchctl enable "$DOMAIN/$LABEL"

    echo "Starting $APPNAME service..."
    launchctl kickstart -k "$DOMAIN/$LABEL"

    echo "Checking service status..."
    status

    echo "Done."
}

case "${1:---install}" in
    --install)
        install
        ;;
    --restart)
        stop
        install
        ;;
    --stop)
        stop
        ;;
    --status)
        status
        ;;
    --help|-h)
        usage
        ;;
    *)
        usage >&2
        exit 1
        ;;
esac