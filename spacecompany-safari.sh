#!/usr/bin/env bash
set -euo pipefail

# Load the neighboring script into the first matching Space Company tab.
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
script_path="$script_dir/spacecompany.js"

if [[ ! -r "$script_path" ]]; then
    printf 'Cannot read %s\n' "$script_path" >&2
    exit 1
fi

exec /usr/bin/osascript - "$script_path" <<'APPLESCRIPT'
on run arguments
    set scriptSource to read (POSIX file (item 1 of arguments)) as «class utf8»
    if application "Safari" is not running then
        error "Open Space Company in Safari first."
    end if

    tell application "Safari"
        set gameTabs to {}
        repeat with browserWindow in windows
            repeat with browserTab in tabs of browserWindow
                set tabURL to URL of browserTab
                set tabTitle to name of browserTab
                ignoring case
                    if tabURL contains "spacecompany" or tabTitle contains "Space Company" then
                        set end of gameTabs to contents of browserTab
                    end if
                end ignoring
            end repeat
        end repeat

        if (count gameTabs) is 0 then
            error "No Space Company tab found in Safari. Open the game first."
        end if

        set gameTab to item 1 of gameTabs
        set gameReady to do JavaScript "typeof Game === 'object' && typeof Game.resources === 'object' && typeof Game.tech === 'object' && document.getElementById('tabList') !== null" in gameTab
        if gameReady is not true then
            error "The Space Company tab is not ready. Wait for the game to finish loading."
        end if

        set injection to "try {" & linefeed & scriptSource & linefeed & "; document.getElementById('automonkeyPanel') !== null && monkeyrunner.timeoutID !== null; } catch (error) { console.error('Automonkey injection failed', error); false; }"
        set loaded to do JavaScript injection in gameTab
        if loaded is not true then
            error "Automonkey did not start. Check the game tab's JavaScript console for details."
        end if
    end tell
    return "Automonkey loaded into the Space Company tab."
end run
APPLESCRIPT
