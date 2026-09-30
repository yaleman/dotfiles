# Scheduled wiki update on macOS

`updatewiki-cron.sh` runs as the user LaunchAgent `com.yaleman.updatewiki`.
Launchd starts it at 00:00, 04:00, 08:00, 12:00, 16:00, and 20:00 in the
Mac's local time zone, and once when the agent loads. The script only calls
`updatewiki` when `/etc/resolv.conf` contains a `search housenet` line.
`updatewiki` uses `WIKIDIR` from `~/.zshrc` and can commit and push wiki changes.

The agent is installed at `$HOME/Library/LaunchAgents/com.yaleman.updatewiki.plist`, which is also included in this repo.
It runs while this user is logged in. If the Mac sleeps through a calendar run,
launchd runs one missed invocation when it wakes; it does not replay every missed
run. The agent points to this checkout, so keep `updatewiki-cron.sh` here.

Launchd writes stdout to `/tmp/com.yaleman.updatewiki.log` and stderr to
`/tmp/com.yaleman.updatewiki.err`. It does not rotate them. Temporary files
can be removed by macOS, but `/tmp` does not provide a size or age limit for
these logs while the job keeps writing to them.

## Install

Run this block from the repository root. The checked-in plist is a template:
`envsubst` resolves `$HOME` in the executable and working directory paths
before launchd loads it. Loading starts the first update immediately. If an
older version is loaded, the block unloads it first.

```sh
if launchctl print "gui/$(id -u)/com.yaleman.updatewiki" >/dev/null 2>&1; then
    launchctl bootout "gui/$(id -u)/com.yaleman.updatewiki"
fi
mkdir -p "$HOME/Library/LaunchAgents"
envsubst '$HOME' < com.yaleman.updatewiki.plist > "$HOME/Library/LaunchAgents/com.yaleman.updatewiki.plist"
plutil -lint "$HOME/Library/LaunchAgents/com.yaleman.updatewiki.plist"
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.yaleman.updatewiki.plist"
```

To check whether it loaded and how the most recent run ended:

```sh
launchctl print "gui/$(id -u)/com.yaleman.updatewiki"
tail /tmp/com.yaleman.updatewiki.log /tmp/com.yaleman.updatewiki.err
```

## Remove

Unload the job before deleting its plist:

```sh
launchctl bootout "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.yaleman.updatewiki.plist"
rm "$HOME/Library/LaunchAgents/com.yaleman.updatewiki.plist"
```

The files in `/tmp` can also be deleted if no longer needed.
