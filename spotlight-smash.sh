#!/bin/bash

# this script rebuilds the Launch Services database and restarts Finder, Dock, and Spotlight.
# use it when spotlight shits itself again

LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

echo "Rebuilding Launch Services database..."

"$LSREGISTER" -r -domain local -domain system -domain user

echo "Rebuilding Launch Services database complete."

echo "Restarting Finder, Dock, and Spotlight..."

killall lsd 2>/dev/null
killall Spotlight 2>/dev/null
killall Dock 2>/dev/null

echo "Done!"