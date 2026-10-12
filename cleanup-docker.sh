#!/bin/bash

if [ ! -e "$HOME/.orbstack/run/docker.sock" ]; then
   echo "Docker's not running!"
   exit 0
   fi

docker system prune --all --force --volumes || true
docker system prune --all --force || true
docker buildx prune --all --force || true
docker buildx history rm --all || true