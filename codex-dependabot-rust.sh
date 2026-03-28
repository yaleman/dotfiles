#!/bin/bash


PROMPT="run \`cargo clippy\` and update the code so it works, this is a package update PR so if you have to downgrade things rather than update them then report it and stop work."

codex exec "$PROMPT"