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

Launchd writes to the configured stdout and stderr files but does not rotate
them. This Mac has no `newsyslog` rule for the updatewiki logs, so they will
grow until a rotation rule or another cleanup mechanism is added.

## Install

Run this block from the repository root. It writes the same LaunchAgent
configuration used on this machine and loads it immediately, which starts the
first update. If the agent is already loaded, remove it first using the block
below.

```sh
python3 - <<'PY'
import pathlib
import plistlib

repo = pathlib.Path.cwd().resolve()
home = pathlib.Path.home()
agent = home / 'Library/LaunchAgents/com.yaleman.updatewiki.plist'
agent.parent.mkdir(parents=True, exist_ok=True)
job = {
    'Label': 'com.yaleman.updatewiki',
    'ProgramArguments': [str(repo / 'updatewiki-cron.sh')],
    'WorkingDirectory': str(repo),
    'EnvironmentVariables': {
        'PATH': '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
    },
    'StartCalendarInterval': [
        {'Hour': hour, 'Minute': 0} for hour in range(0, 24, 4)
    ],
    'RunAtLoad': True,
    'StandardOutPath': str(home / 'Library/Logs/updatewiki.log'),
    'StandardErrorPath': str(home / 'Library/Logs/updatewiki.err'),
}
agent.write_bytes(plistlib.dumps(job))
agent.chmod(0o644)
PY
plutil -lint "$HOME/Library/LaunchAgents/com.yaleman.updatewiki.plist"
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.yaleman.updatewiki.plist"
```

To check whether it loaded and how the most recent run ended:

```sh
launchctl print "gui/$(id -u)/com.yaleman.updatewiki"
tail "$HOME/Library/Logs/updatewiki.log" "$HOME/Library/Logs/updatewiki.err"
```

## Remove

Unload the job before deleting its plist:

```sh
launchctl bootout "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.yaleman.updatewiki.plist"
rm "$HOME/Library/LaunchAgents/com.yaleman.updatewiki.plist"
```

The logs in `$HOME/Library/Logs/updatewiki.log` and
`$HOME/Library/Logs/updatewiki.err` can also be deleted if no longer needed.
