#!/bin/bash

if [ -n "$1" ]; then
  echo "Running with checks: $*"
  CHECKS="$*"
else
    CHECKS="uv run ruff check && uv run ty check && uv run pytest"
fi

PROMPT="run \`${CHECKS}\` and update the code so it works, this is a package update PR so if you have to downgrade things rather than update them then report it and stop work. when you think you're done, run \`${CHECKS}\` and validate that everything is working and then report that you are done and what you did to fix the code."

codex exec --full-auto "$PROMPT"