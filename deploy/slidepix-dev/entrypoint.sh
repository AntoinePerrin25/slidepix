#!/bin/sh
set -eu

token_file=/run/slidepix/connection-token
if [ ! -s "${token_file}" ]; then
  echo "Refusing to start: ${token_file} is missing or empty." >&2
  echo "Write a secret to deploy/slidepix-dev/connection-token before docker compose up." >&2
  exit 1
fi

exec "${OPENVSCODE_SERVER_ROOT}/bin/openvscode-server" \
  --host 0.0.0.0 \
  --port 3000 \
  --server-base-path /slidepix-dev \
  --default-folder /home/workspace/decks \
  --extensions-dir /opt/slidepix/extensions \
  --connection-token-file "${token_file}" \
  "$@"
