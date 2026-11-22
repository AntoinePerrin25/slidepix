# MCP module

Package: `@slidepix/mcp`

Purpose: expose deck inspection and a code-mode authoring API over MCP stdio.
The extension's **AI** action writes this server into the Cursor, VS Code,
Codex, Claude Code, and Claude Desktop user configs. Agents only see the tools
after a new chat. This document is an implementation reference, not host setup
instructions.

## `src/server.ts`

`buildServer()` registers four tools before `serveStdio` starts the process:

| Tool | Output |
| --- | --- |
| `list_slides(deckPath)` | Deck title, dimensions, and every slide's ID, 1-based index, title, hidden state, and notes availability. Never writes. |
| `inspect_slides(deckPath, slideIds?, indices?)` | Structured slide, transition, timeline, and element metadata. Never writes. |
| `search({ code })` | Runs the JavaScript against the authoring catalog in `codemode`. Never reads or writes a deck. |
| `execute({ deckPath, code, create? })` | Runs the JavaScript against `slidepix` for one deck. The host validates the result and writes that file only when the deck changed. `create` writes a new file when the path is missing. |

The tool schemas stay small. Field names, defaults, and short examples live in
`src/catalog.ts` and are read through `search`, so they are not repeated in
every chat's tool list. There is no `apply` operations tool.

The extension's **AI** action points every host at `dist/mcp.cjs` inside the
installed extension and launches it with that host's Node (`ELECTRON_RUN_AS_NODE`).
A separate Node.js runtime is not required. A server process that was already
running keeps its old tools until that MCP entry is reloaded.

Guest code returns JSON. Host values cross the sandbox only as JSON, so the
script cannot receive a filesystem or process handle. The server does not copy
media bytes.

## `src/tools.ts`

| Export | Contract |
| --- | --- |
| `loadDeck(deckPath)` | Reads UTF-8 text and validates it through core. It never writes. |
| `selectSlides(deck, slideIds?, indices?)` | Selects IDs in deck order, maps 1-based indices in requested order, or defaults to all visible slides. Unknown IDs/indices throw clear errors. |

## `src/editor.ts` and `src/code-mode.ts`

`createEditor(deck)` is the host API behind `slidepix`. Each call clones the
deck, applies one operation, and parses the result through `parseDeckText`.
`executeDeck` serializes with `serializeDeck`, refuses a deck path that is not
an absolute `.slidepix.json` file, and skips the write when the canonical text
is unchanged. If the file changes after it was read, the write fails and the
newer text stays.

Private helpers must continue to call core's `resolveMediaPath` with the
element's explicit storage mode when they read media. The code-mode API does
not read or write asset bytes.

## Native agent guidance

- Review: [`.cursor/rules/slidepix-mcp.mdc`](../../.cursor/rules/slidepix-mcp.mdc) and [`.agents/skills/slidepix-mcp-review/SKILL.md`](../../.agents/skills/slidepix-mcp-review/SKILL.md)
- Authoring: [`.agents/skills/slidepix-pres/SKILL.md`](../../.agents/skills/slidepix-pres/SKILL.md)

## Tests and security boundary

`src/tools.test.ts` covers selection. `src/code-mode.test.ts` covers a saved
edit, an unchanged read, a rejected invalid element, catalog search, and the
absence of the host process inside guest code. No MCP code may write, rename,
or delete an asset file.
