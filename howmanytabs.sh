#!/bin/bash

set -e

function f () {
    #shellcheck disable=SC2069
    osascript howmanytabsraw 2>&1 >/dev/null
}


#shellcheck disable=SC2069
f 2>&1 >/dev/null
