#!/bin/bash

# Pulls the current beta key from the forums and updates your settings file

URL='https://forum.makemkv.com/forum/viewtopic.php?f=5&t=1053'

RESULT="$(curl -s "${URL}" \
    | grep -oE 'code>\T([^\<]+)' \
    | awk -F'>' '{print $2}')"

if [ -z "${RESULT}" ]; then
    echo "Couldn't pull key, check ${URL}"
    exit 1
else
    echo "Found new key: ${RESULT}"
fi

SETTINGS_DIR="$HOME/Library/MakeMKV"
SETTINGS_FILE="${SETTINGS_DIR}/settings.conf"

if [ ! -d "${SETTINGS_DIR}" ]; then
    echo "Can't find MakeMKV preferences directory, creating it, hit ctrl-c if you don't want to"
    pause
    mkdir -p "${SETTINGS_DIR}"
fi


if [ -f "${SETTINGS_FILE}" ]; then
    echo "Backing up old settings.conf to settings.conf.bak"
    cp "${SETTINGS_FILE}" "${SETTINGS_FILE}.bak"
else
    echo "Creating bare settings file"
    cat << EOF > "${SETTINGS_FILE}.new"
app_DestinationDir = "${HOME}/Movies"
app_Java = ""
app_Key = "${RESULT}""
app_Proxy = ""
app_ccextractor = ""
sdf_Stop = ""
EOF

exit 0

fi

# update the app_Key line
sed -i '' "s/app_Key = .*/app_Key = \"${RESULT}\"/" "${SETTINGS_FILE}"

echo "Done!"