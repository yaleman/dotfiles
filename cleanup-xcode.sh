#!/bin/bash

TARGET_PATH="${1:-$HOME/Projects}"

fd '\.xcodeproj$' --no-ignore --type d --hidden "$TARGET_PATH" --exec-batch bash -c "echo 'swift cleaning {//}' && cd '{//}' && swift package clean"