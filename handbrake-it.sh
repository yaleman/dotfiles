#!/bin/bash

# turns mp4 files into mkvs

if [ $# -ne 1 ]; then
    echo "Usage: $0 <filename>"
    exit 1
fi

set -e

INPUT_FILENAME="$1"
#shellcheck disable=SC2001
EXTENSION="$(echo "$1" | awk -F'.' '{print $NF}' )"
OUTPUT_FILENAME="$(echo "$1" | sed -E "s/(${EXTENSION})\$/mkv/" )"

if [ -f "${OUTPUT_FILENAME}" ]; then
    echo "Skipping ${INPUT_FILENAME} - ${OUTPUT_FILENAME} already exists"
    exit 0
fi

echo "Encoding '${INPUT_FILENAME}' to '${OUTPUT_FILENAME}'"
HandBrakeCLI --encoder vt_h265_10bit  \
    --vfr \
    --format av_mkv \
    -i "${INPUT_FILENAME}" \
    -o "${OUTPUT_FILENAME}"

# ensure $OUTPUT_FILENAME exists and is non-zero in size
if [ ! -s "${OUTPUT_FILENAME}" ]; then
    echo "ERROR: ${OUTPUT_FILENAME} is zero size"
    exit 1
fi

# compare $INPUT_FILENAME and $OUTPUT_FILENAME and delete the larger one
INPUT_SIZE=$(stat -f%z "${INPUT_FILENAME}")
OUTPUT_FILENAME_SIZE=$(stat -f%z "${OUTPUT_FILENAME}")

if [ -n "${DONT_DELETE}" ]; then
    echo "DONT_DELETE is set - skipping delete"
    exit 0
fi

if [ "${INPUT_SIZE}" -gt "${OUTPUT_FILENAME_SIZE}" ]; then
    echo "Deleting ${INPUT_FILENAME} - input ${INPUT_SIZE} > ${OUTPUT_FILENAME_SIZE}"
    rm "${INPUT_FILENAME}"
else
    echo "New file is larger ${OUTPUT_FILENAME_SIZE} > ${INPUT_SIZE}} - deleting ${OUTPUT_FILENAME}"
    rm "${OUTPUT_FILENAME}"
fi