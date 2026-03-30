#!/bin/bash


PROMPT="run \`cargo clippy\` and update the code so it works, this is a package update PR so if you have to downgrade things rather than update them then report it and stop work. when you think you're done, run \`cargo fmt && cargo clippy && cargo test\` and validate that everything is working and then report that you are done and what you did to fix the code."

codex exec --full-auto "$PROMPT"