#!/bin/bash

# This script will run the latest version of scoutsuite in a docker container

# You will need to set the following environment variables:
# AWS_ACCESS_KEY_ID
# AWS_SECRET_ACCESS_KEY

#shellcheck disable=SC1090
source ~/.config/scoutsuite.env

LATEST="$(docker image ls | grep scoutsuite | head -n1 | awk '{print $2}')"

if [ -z "${LATEST}" ]; then
	echo "Can't find a scoutsuite docker image?"
	exit 1
fi

AWS_ACCOUNT_ID="$(aws sts get-caller-identity | jq -r .Account)"

MYDIR="$(dirname "$0")"

docker run --rm -it \
	--mount 'type=bind,src=./report,target=/root/scoutsuite-report' \
	--mount "type=bind,src=${MYDIR}/scoutsuite-update.sh,target=/usr/local/bin/scoutsuite-update.sh" \
	-p "8072:8000" \
	-e "AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID}" \
	-e "AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}" \
	-e "AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}" \
	--name scoutsuite \
	"nccgroup/scoutsuite:${LATEST}"
