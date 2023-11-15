#!/bin/bash

# turns mp4 files into mkvs

INPUT_FILENAME="$1"
#shellcheck disable=SC2001
OUTPUT_FILENAME="$(echo "$1" | sed -E 's/(m4v|mp4)$/mkv/' )"

if [ ! -f "${OUTPUT_FILENAME}" ]; then
    echo "Writing ${OUTPUT_FILENAME}"
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
    if [ "${INPUT_SIZE}" -gt "${OUTPUT_FILENAME_SIZE}" ]; then
        echo "Deleting ${INPUT_FILENAME}"
        rm "${INPUT_FILENAME}"
    else
        echo "New file is larger ${OUTPUT_FILENAME_SIZE} > ${INPUT_SIZE}} - deleting ${OUTPUT_FILENAME}"
        rm "${OUTPUT_FILENAME}"
    fi
else
    echo "Skipping ${INPUT_FILENAME} - ${OUTPUT_FILENAME} already exists"
fi