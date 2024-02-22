#!/bin/bash

if [ "$(which fd | wc -l)" -eq 0 ]; then
	echo "Can't find fd, quitting!"
	exit 1
fi

fd '(mp4|m4v|mov|avi)$' --threads=1 --exec handbrake-it.sh "{}"
