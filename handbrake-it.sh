#!/bin/bash

# turns mp4 files into mkvs

INPUT_FILENAME="$1"
#shellcheck disable=SC2001
OUTPUT="$(echo "$1" | sed -e s/mp4/mkv/)"

if [ ! -f "${OUTPUT}" ]; then
    echo "Writing ${OUTPUT}"
    HandBrakeCLI --encoder vt_h265_10bit  \
        --vfr \
        --format av_mkv \
        -i "${INPUT_FILENAME}" \
        -o "${OUTPUT}"

    # ensure $OUTPUT exists and is non-zero in size
    if [ ! -s "${OUTPUT}" ]; then
        echo "ERROR: ${OUTPUT} is zero size"
        exit 1
    fi

    # compare $INPUT_FILENAME and $OUTPUT and delete the larger one
    INPUT_SIZE=$(stat -f%z "${INPUT_FILENAME}")
    OUTPUT_SIZE=$(stat -f%z "${OUTPUT}")
    if [ "${INPUT_SIZE}" -gt "${OUTPUT_SIZE}" ]; then
        echo "Deleting ${INPUT_FILENAME}"
        rm "${INPUT_FILENAME}"
    fi
else
    echo "Skipping ${INPUT_FILENAME} - ${OUTPUT} already exists"
fi