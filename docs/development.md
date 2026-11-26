# Development and release guide

This guide is for people modifying SlidePix. People who only want to use the
extension should follow the root [README](../README.md).

## Prerequisites

Set up Git, Node.js 20, and the pinned pnpm on Ubuntu or macOS (zsh) with
[docs/install.md](install.md). That guide also covers the first `pnpm install`,
`pnpm build`, `pnpm package`, and installing the produced VSIX.

Once the toolchain is present:

- Node.js 20 or newer
- pnpm 10.29.3 (the repository pins this version in `package.json`)
- desktop VS Code for the Extension Development Host

From the repository root:

```sh
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm docs:check
pnpm test:live
```

`pnpm test:live` is separate from `pnpm test`. It binds two local iroh endpoints
with relays disabled. `pnpm package` stages the current platform's iroh binary
and passes `--target` to vsce from a Node script, so the same command works in
`cmd.exe`. `pnpm package:all` covers darwin-arm64, linux-x64,
linux-arm64, win32-x64, and win32-arm64. It runs `vsce package` once, then
writes each other target by copying that VSIX and replacing the iroh binary
plus the manifest `TargetPlatform`. `pnpm publish:all` produces those VSIXes
the same way, then uploads every VSIX to the Visual Studio Marketplace and
Open VSX at the same time. `--no-dependencies` keeps `vsce`
from running `npm list` in this pnpm workspace. `VSCE_PAT` and `OVSX_PAT`
must be set. Intel macOS has no published iroh
binary; `pnpm build` and `pnpm package` still succeed there and the editor
reports that live collaboration is unavailable. An explicit unsupported
`--target` still fails.

Extension and MCP Vitest configurations alias `@slidepix/core` directly to its
source. Tests therefore work in a fresh checkout before `packages/core/dist`
exists; do not remove those aliases or make `pnpm test` depend on stale build
output.

No browser is downloaded by `pnpm install` or embedded in the VSIX. PDF and PNG
export run inside the editor webview. `scripts/render-smoke.mjs` needs Google
Chrome or Microsoft Edge already installed on the machine.

## Debug the extension

1. Run `pnpm build`.
2. Open the repository root in VS Code.
3. Press `F5` and choose **VS Code Extension Development** if prompted.
4. In the new Extension Development Host, run **SlidePix: Create Deck**.
5. After source changes, run `pnpm build` again and reload the development host.

`pnpm dev` watches the webview and the `slidepix-deck` extension bundle. The
Extension Development Host still needs **Developer: Reload Window** to load a
new `dist/extension.cjs`.

## Verification by change type

| Change | Minimum verification |
| --- | --- |
| Documentation only | `pnpm docs:check` |
| Schema/assets/protocol | `pnpm test`, `pnpm typecheck`, `pnpm build` |
| Git collaboration/merge driver | Previous checks plus the extension integration tests; manually configure, merge, resolve, stage, and remove in a temporary repository. |
| Webview behavior | `pnpm typecheck`, `pnpm build`, manual Extension Development Host test |
| Rendering/motion | previous checks plus `node scripts/render-smoke.mjs`; inspect the contact sheet, PDF, and `slides/` exact-size PNG frames |
| Presentation/export | previous checks plus audience/presenter and PDF/PNG/PPTX/Web manual smoke tests; inspect native PPTX object editability and motion in PowerPoint, with LibreOffice as an additional compatibility check |
| MCP | `pnpm test`, `pnpm typecheck`, build, start bundled stdio server, and render one/many slides |
| Release | all checks on the target OS, then `pnpm package` and install the produced VSIX. Publish with `pnpm publish:all`. |

## Package a VSIX

Run:

```sh
pnpm package
```

The current-platform artifact is
`packages/extension/slidepix-deck-<target>-<version>.vsix`. Install that file
with **Extensions → … → Install from VSIX…** in both VS Code and Cursor before
publishing it.

Publish every platform with:

```sh
export VSCE_PAT="..."
export OVSX_PAT="..."
pnpm publish:all
```

`pnpm publish:all` builds the workspace once, packages `darwin-arm64`, and
derives `linux-x64`, `linux-arm64`, `win32-x64`, and `win32-arm64` from that
VSIX by swapping the iroh binary and `TargetPlatform`. It then publishes every
VSIX at once. The Open VSX namespace must be `antoineperrin`, matching the
Marketplace publisher. A target already present on either registry is skipped.
Pass targets after the script to publish a subset:
`pnpm --filter slidepix-deck publish:all -- darwin-arm64`.
The first target is the one `vsce package` builds; the rest are derived from
it. Open VSX alone uses `pnpm publish:ovsx` and needs only `OVSX_PAT`.
Those uploads still run concurrently, one per target.

## Generated-output discipline

Never patch `dist`, `media`, or the generated JSON Schema.
Change their sources and rebuild. The complete generated-file table and all
script responsibilities are in [architecture.md](../architecture.md).
