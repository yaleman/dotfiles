#!/usr/bin/env python3

# This takes the REGISTRY_IMAGE env ( echo "REGISTRY_IMAGE=ghcr.io/${GITHUB_REPOSITORY,,}" >>${GITHUB_ENV} as the first argument - a string indicating the image name in the registry
# and the DOCKER_METADATA_OUTPUT_JSON env ( output of docker/metadata-action ) as the second argument - a JSON string containing tags
# and creates a docker manifest list using docker buildx imagetools create
#
# Example usage in GitHub Actions:
# - name: Create manifest list and push
#  working-directory: /tmp/digests
#  run: |
#    ${GITHUB_WORKSPACE}/scripts/docker_create_manifest_list.py "${{ env.REGISTRY_IMAGE }}" "$DOCKER_METADATA_OUTPUT_JSON"

import json
import os
import sys
import subprocess

registry_image = sys.argv[1]
docker_metadata_output_json = sys.argv[2]

print(f"Registry image: '{registry_image}'", file=sys.stderr)
print(f"Docker metadata output JSON: '{docker_metadata_output_json}'", file=sys.stderr)

try:
    docker_meta = json.loads(docker_metadata_output_json)
except json.JSONDecodeError as e:
    print(f"Error JSON-decoding DOCKER_METADATA_OUTPUT_JSON: {e}", file=sys.stderr)
    sys.exit(1)

tags = []
for tag in docker_meta.get("tags", []):
    tags.append("-t")
    tags.append(tag)

print(f"Tags for manifest list: {tags}", file=sys.stderr)

digests = [
    f"{registry_image}@sha256:{digest}"
    for digest in [filename for filename in os.listdir(".") if os.path.isfile(filename)]
]
if not digests:
    print("Error: No digest files found in current directory", file=sys.stderr)
    sys.exit(1)
print(f"Digests: {digests}", file=sys.stderr)

if not tags:
    print("Error: No tags found in metadata", file=sys.stderr)
    sys.exit(1)

command = ["docker", "buildx", "imagetools", "create", *tags, *digests]
print(f"Command: {command}", file=sys.stderr)

try:
    result = subprocess.run(command, check=True)
except subprocess.CalledProcessError as e:
    print(
        f"CalledProcessError running docker buildx imagetools create: {e}",
        file=sys.stderr,
    )
    sys.exit(1)
except Exception as e:
    print(f"Exception running docker buildx imagetools create: {e}", file=sys.stderr)
    sys.exit(1)
