#!/bin/bash

codex --full-auto \
    'migrate this repository to using uv as the package manager, ensure dependencies are upgraded to reasonably new versions. replace mypy with ty, and update all scripts or CI that use mypy; do NOT rename github actions tasks or jobs.'