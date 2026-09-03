#!/bin/bash

TARGET_PATH="${1:-$HOME/Projects}"

fd '\.xcodeproj$' --no-ignore --type d --hidden "$TARGET_PATH" --exec-batch bash -c "echo 'swift cleaning {//}' && cd '{//}' && swift package clean"

if [ -d "$HOME/Library/Developer/Xcode/DerivedData" ]; then
  echo "Cleaning DerivedData..."
  rm -rf "$HOME/Library/Developer/Xcode/DerivedData/*"
fi

# TODO: clean up old versions of Device Support
# $HOME/Library/Developer/Xcode/iOS\ DeviceSupport
# drwxr-xr-x   8 yaleman  staff  256 Aug  5 10:04 iPad16,1 26.5 (23F77)
# drwxr-xr-x   8 yaleman  staff  256 Jul 29 23:07 iPhone17,1 26.5.2 (23F84)
# drwxr-xr-x   8 yaleman  staff  256 Aug 18 16:03 iPhone17,1 26.6 (23G71)
# drwxr-xr-x   8 yaleman  staff  256 Aug 19 14:59 iPhone17,1 26.6.1 (23G83)

