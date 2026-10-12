#!/bin/bash
set -euo pipefail

conf=/etc/apache2/sites-available/antoinep.conf
marker="# slidepix-dev"
block=$(cat <<'EOF'
    # slidepix-dev
    ProxyPass        /slidepix-dev http://127.0.0.1:3010/slidepix-dev upgrade=websocket
    ProxyPassReverse /slidepix-dev http://127.0.0.1:3010/slidepix-dev
EOF
)

if [[ ! -f "$conf" ]]; then
  echo "Missing $conf" >&2
  exit 1
fi

a2enmod proxy proxy_http proxy_wstunnel >/dev/null

if grep -q "$marker" "$conf"; then
  echo "Apache already proxies /slidepix-dev"
else
  cp "$conf" "${conf}.bak-slidepix-$(date +%Y%m%d%H%M%S)"
  python3 - "$conf" "$block" <<'PY'
import pathlib, sys
path, block = sys.argv[1], sys.argv[2]
file = pathlib.Path(path)
file.write_text(file.read_text().replace(
    "    ErrorLog ${APACHE_LOG_DIR}/error.log\n",
    block + "\n\n    ErrorLog ${APACHE_LOG_DIR}/error.log\n",
    1,
))
PY
  echo "Inserted /slidepix-dev proxy into $conf"
fi

apache2ctl configtest
systemctl reload apache2
echo "Apache reloaded"
