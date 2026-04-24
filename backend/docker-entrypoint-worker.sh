#!/bin/bash
set -e

# Ensure the worker process can access the Docker socket regardless of host GID
if [ -S /var/run/docker.sock ]; then
    DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)
    if ! getent group dockerhost > /dev/null 2>&1; then
        groupadd -g "$DOCKER_GID" dockerhost 2>/dev/null || true
    fi
    usermod -aG dockerhost root 2>/dev/null || true
    chmod 660 /var/run/docker.sock 2>/dev/null || true
fi

exec "$@"
