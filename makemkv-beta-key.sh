#!/bin/bash

# Pulls the current beta key from the forums

URL='https://forum.makemkv.com/forum/viewtopic.php?f=5&t=1053'

RESULT="$(curl -s "${URL}" \
    | grep -oE 'code>\T([^\<]+)' \
    | awk -F'>' '{print $2}')"

if [ -z "${RESULT}" ]; then
    echo "Couldn't pull key, check ${URL}"
else
    echo "${RESULT}"
fi