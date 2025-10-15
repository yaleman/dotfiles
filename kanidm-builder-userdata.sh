#!/bin/bash

set -e
# install things
sudo apt-get update
sudo apt-get install -y docker.io ripgrep jq ufw docker-buildx

# configure docker to listen
sudo mkdir -p /etc/systemd/system/docker.service.d/
cat > /etc/systemd/system/docker.service.d/override.conf <<EOF
[Service]
ExecStart=
ExecStart=/usr/sbin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock -H tcp://0.0.0.0:2375 $DOCKER_OPTS
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker.service
# firewall things
sudo ufw allow ssh
sudo ufw allow 2375/tcp
echo y | sudo ufw enable

echo "Done!"