#!/bin/bash

if [ -z "$1" ]; then
    echo "Usage: $0 <PR_URL>"
    exit 1
fi

if [ -n "$2" ]; then
    echo "Using model: $2"
    EXTRA_ARGS="--model $2"
else
    # echo "Using default model"
    EXTRA_ARGS=""
fi

echo "Checking out $1..."
gh pr checkout "$1" || { echo "Failed to check out PR $1"; exit 1; }

PROMPT="This PR is failing to build - try to build/check it and and fix all errors/warnings, ensuring that the code is clean and follows best practices. Do not change any functionality or logic, only address the errors/warnings/issues. once you're sure it works, commit and push the changes to the PR branch."

echo "Starting opencode with this prompt:"
echo "$PROMPT"
echo "-----------------------------------------"
# shellcheck disable=SC2086
opencode run --thinking --title "fixing $1" --print-logs $EXTRA_ARGS "$PROMPT"