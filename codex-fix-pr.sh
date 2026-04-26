#!/bin/bash

if [ -z "$1" ]; then
    echo "Usage: $0 <PR_URL>"
    exit 1
fi

codex --full-auto \
    "check out the PR $*, try to build/check it and and fix all errors/warnings, ensuring that the code is clean and follows best practices. Do not change any functionality or logic, only address the errors. once you're sure it works, commit and push the changes to the PR branch."