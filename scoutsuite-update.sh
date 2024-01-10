#!/bin/bash


if [ -z "${AWS_ACCOUNT_ID}" ]; then
    echo "AWS_ACCOUNT_ID not set"
    AWS_ACCOUNT_ID="$(aws sts get-caller-identity | jq -r .Account)"
    if [ -z "${AWS_ACCOUNT_ID}" ]; then
        echo "Couldn't pick it up automagically, bailing!"
        exit 1
    fi
fi

REPORT_FORMAT="json"

if [ "${REPORT_FORMAT}" == "json" ]; then
    REPORT_EXTENSION="js"
else
    REPORT_EXTENSION="db"
fi

REPORT_FILENAME="scoutsuite-report/scoutsuite-results/scoutsuite_results_aws-${AWS_ACCOUNT_ID}.${REPORT_EXTENSION}"

EXCEPTIONS_FILENAME="./scoutsuite-report/scoutsuite-results/exceptions-aws-${AWS_ACCOUNT_ID}.json"

if [ ! -f "${EXCEPTIONS_FILENAME}" ]; then
    echo "Creating blank exceptions file"
    echo 'exceptions = ' > "${EXCEPTIONS_FILENAME}"
    echo '{}' >> "${EXCEPTIONS_FILENAME}"
else
    echo "Loading exceptions from ${EXCEPTIONS_FILENAME}"
fi

if [ -f "${REPORT_FILENAME}" ]; then
	echo "Report file found: ${REPORT_FILENAME}"
	scout aws \
		--force \
		--update \
		--result-format json \
        --exceptions "${EXCEPTIONS_FILENAME}"
else
	echo "Report file not found: ${REPORT_FILENAME}"
	scout aws \
        --result-format json \
        --exceptions "${EXCEPTIONS_FILENAME}"

fi

echo "Look for ${REPORT_FILENAME}"
