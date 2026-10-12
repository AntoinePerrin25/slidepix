# SlidePix in the browser

This page runs OpenVSCode Server on an Ubuntu Raspberry Pi and publishes it at
`/slidepix-dev`. The workbench provides the file explorer, Git, and the
terminal. SlidePix is installed from the `linux-arm64` VSIX and runs in the
server's Node extension host.

The image is `gitpod/openvscode-server:1.105.1`, which satisfies the extension
engine `vscode: ^1.99.0` and already includes Git. Use a 64-bit Ubuntu image
(arm64). A Pi with 4 GB of RAM is the practical minimum.

## Build the VSIX

On a machine with the SlidePix toolchain from [install.md](install.md):

```sh
pnpm package:all
```

[package-all.mjs](../packages/extension/scripts/package-all.mjs) writes one
VSIX per target. Copy the arm64 file next to the Docker build:

```sh
cp packages/extension/slidepix-0.1.0-linux-arm64.vsix \
  deploy/slidepix-dev/slidepix-linux-arm64.vsix
```

The version in the filename follows `packages/extension/package.json`. The
Docker build expects the stable name `slidepix-linux-arm64.vsix`. That file
is gitignored.

## Start the server

Copy `deploy/slidepix-dev/` to the Pi, including the VSIX. From that directory:

```sh
umask 077
openssl rand -hex 32 > connection-token
chmod 644 connection-token
mkdir -p decks
sudo chown 1000:1000 decks
docker compose up -d --build
docker compose logs
```

`connection-token` is required. The entrypoint exits if the file is missing or
empty, and it does not pass `--without-connection-token`. Compose publishes
the container only on `127.0.0.1:3010`. The host port is 3010 because 3000 is
a common local service port. Inside the container the server still listens on
port 3000. Deck files live in `./decks`,
mounted at `/home/workspace/decks`, which is the folder opened on startup.
Files created by the editor are owned by uid 1000.

The log line `Web UI available at` includes the `tkn` query. With the base
path, open that path under `/slidepix-dev/` rather than the site root.

## Reverse proxy

The backend expects the `/slidepix-dev` prefix. The proxy must forward that
prefix unchanged to `127.0.0.1:3010`.

For Apache 2.4.47 or newer, put this inside the existing HTTPS virtual host
and enable `proxy_wstunnel`:

```apache
ProxyPass        /slidepix-dev http://127.0.0.1:3010/slidepix-dev upgrade=websocket
ProxyPassReverse /slidepix-dev http://127.0.0.1:3010/slidepix-dev
```

For nginx, add [nginx-slidepix-dev.conf](../deploy/slidepix-dev/nginx-slidepix-dev.conf)
to the existing TLS server. The `proxy_pass` line has no URI path, so nginx
does not strip `/slidepix-dev`. WebSocket upgrades use `Upgrade` and
`Connection`. Reload the proxy, then open:

```text
https://<host>/slidepix-dev/?tkn=<token>
```

## Check the page

1. The Explorer shows `/home/workspace/decks`.
2. Source Control is available. Initialize or clone a Git repository inside
   `decks` before expecting a branch and changes.
3. Open or create a `*.slidepix.json` file. It opens in the SlidePix editor.

**Present** and **Presenter** still bind to `127.0.0.1` inside the container.
A browser on another computer cannot open that audience URL. Use **Export Web**
for a page you can share. See [architecture.md](../architecture.md) and the
[extension module](modules/extension.md).
