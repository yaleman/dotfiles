#!/bin/bash

tokei --files --compact \
    | rg '^\s+\.\/' \
    | awk '{print $2 " " $1}' \
    | sort -h
