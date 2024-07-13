#!/bin/bash

BACKUP_DIR="$HOME/Nextcloud/Backups/minio-backups"

if [ ! -d "${BACKUP_DIR}" ]; then
    echo "Backup dir ${BACKUP_DIR} not found"
    exit 1
fi

cd "${BACKUP_DIR}" || exit 1

mc admin cluster bucket export housenet
mc admin cluster iam export housenet

# delete files older than a year
echo "Deleting files older than a year"
find "${BACKUP_DIR}" -type f -mtime +365 -ls -delete

echo "Done!"
