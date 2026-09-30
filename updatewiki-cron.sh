#!/bin/bash

MYDIR="$(dirname "${0}")"

if [ "$(rg -c '^search housenet' /etc/resolv.conf)" -gt 0 ]; then
    "${MYDIR}/updatewiki"
else
    echo "Housenet search not found in /etc/resolv.conf" 1>&2
fi