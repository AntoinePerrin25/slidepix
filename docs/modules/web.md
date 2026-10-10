# Web module

Package: `@slidepix/web`

Purpose: serve the SlidePix canvas at `/slidepix` without VS Code. The page
implements the version 2 host protocol, stores one deck and its embedded
media in IndexedDB, and presents with `@slidepix/core`.

## Open this module when

Changing the browser page, its persistence, media URLs, or which desktop
commands stay hidden on that page.

## Files and responsibilities

| File | Responsibility |
| --- | --- |
| `src/session.ts` | Pure host: load, replace, undo/redo, embed an import, present, and refuse desktop-only commands. Reuses the extension snapshot stack in `packages/extension/src/document-history.ts`. |
| `src/storage.ts` | IndexedDB record for the deck text, undo stack, and embedded bytes. |
| `src/browser-host.ts` | Installs `acquireVsCodeApi`, persists after each accepted change, downloads PDF/PNG captures, and opens the file picker. |
| `src/register-sw.ts` and `public/sw.js` | Service worker that serves `/slidepix/media/<file>` from IndexedDB so image and video elements can use ordinary URLs. |
| `src/theme.css` | Light stand-in for the VS Code color variables the canvas expects. |

The React editor stays in `@slidepix/webview`. This package does not render
slides itself. `renderDeckDocument` produces the presentation document opened
in a new tab, with embedded bytes inlined as data URIs.

## Behavior

The first visit opens a one-slide deck titled SlidePix. Later visits reload
the saved text and undo stack. Every replacement is checked against the
current exact-text revision and parsed with `deckSchema`. Images and videos
chosen from the page are stored under their SHA-256 name, the same embedded
reference shape the desktop editor uses, and are limited to 100 MB.

**Save** confirms the copy already written in this browser. **Present** opens
the audience runtime. **PNG** and **PDF** download the capture the canvas
already produced. **Project** downloads a zip of the deck JSON and embedded
assets. Linked media must be embedded first. Manim scripts, live collaboration,
MCP, Git, PowerPoint, and the presenter view stay in the desktop extension. A
deck the page cannot parse offers **Start a new deck**.

The app is built with Vite `base` `/slidepix/`. A site mounts that build on
the `/slidepix` route, or iframes it. Account storage replaces `src/storage.ts`
only; the canvas and session stay as they are.

## Verification

`pnpm --filter @slidepix/web test` covers the demo load, a stored reload, an
accepted replacement, a stale revision, undo, an embedded image import, and
the project zip download.
`pnpm --filter @slidepix/web dev` serves `http://localhost:5173/slidepix/` for
a manual pass: edit, reload, import an image, present, and export a PNG.
