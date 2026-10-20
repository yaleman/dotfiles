# My dotfiles

## SBS On Demand and ABC iview

`sbs-dlp` lists episode URLs from SBS On Demand and ABC iview show pages.
ABC show URLs include all listed seasons; `/show/NAME/series/NUMBER` selects
one season, and `/video/ID` selects one episode. Use `--json` for metadata.

```sh
sbs-dlp --download --subs https://iview.abc.net.au/show/state-of-man
```

Use `--output-dir` to select an existing download directory and
`--cookies-from-browser BROWSER` when browser authentication is needed.
`--handler` and `--login` control SBS downloads; ABC uses standard yt-dlp.

## How Many Tabs

### Configuration

Copy `howmanytabs.plist.example` to `~/.config/howmanytabs.plist`.

Add `howmanytabs.sh` to your cron.

Hey yale, if the logs don't show up use the right token. :smile:
