---
name: slidepix-pres
description: Author or revise a SlidePix presentation in a .slidepix.json deck. Use when creating slides, editing slide text, layout, citations, headers, footers, or morphs, or when an agent is about to generate a Python or Node script that writes the deck JSON.
---

# Author a SlidePix presentation

The SlidePix MCP server has four tools: `list_slides`, `inspect_slides`, `search`, and `execute`. There is no `apply` tool. A call to that name returns "Tool not found".

`search` reads the authoring catalog in `codemode` and does not touch a deck. `execute` edits one `.slidepix.json` file. Do not write a Python or Node script. Do not send an `operations` array. Do not open the extension source, `packages/core`, or `packages/mcp`. If `execute` throws, change the code and call it again. A failed call does not write the file.

## Edit

1. Require an absolute `*.slidepix.json` path. Pass `create: true` only when the file does not exist yet.
2. Copy the script in [reference.md](reference.md) into one `execute`. Change the words. Keep every object shape as written.
3. `execute` JavaScript uses `slidepix` and `return`s a small JSON value. `ref` is a slide id or a 1-based index.
4. If the call throws, change the reported field and call `execute` again. A failed call does not write the file.
5. A read-only `execute` reports `changed: false` and does not rewrite the file.

`search` reads `codemode` and does not touch a deck. Call it only for a field the reference script does not already show. `codemode.operations` is an array: `codemode.operations.find((op) => op.name === "setPageNumbers")`. Listing its keys returns nothing useful.

`list_slides` and `inspect_slides` stay read-only. Use them to review a deck, not to author one.

## Slide design

- The canvas is 1920×1080 unless `slidepix.deck().size` says otherwise. `(0, 0)` is the top left. Keep a 96-unit margin.
- One claim per slide. A title around 64–80px, body around 32–40px, and at least two lines of space between them.
- Text is Markdown: headings, lists, `**bold**`, `$LaTeX$`, and `[@key]`.
- Higher `z` paints above. A morph `name` appears on exactly two slides, and only the second of those slides uses `transition: { type: "morph" }`. Any other repeated name, including a bar or a title, links those objects too.
- Header, footer, and page numbers are deck-wide. `setHeader` and `setFooter` move them on every slide.
- Put `[@key]` in the text that cites it. Mark one slide with `bibliography: true`. The list contains only keys that appear, numbered by first appearance from the top of each visible slide.
- `addElement` for an image or video stores a path; it does not copy the file and does not check that the file exists. Use a workspace-relative `src` with `storage: "linked"`, or an existing hash name with `storage: "embedded"`.

## Surprises

`search` returns `codemode.defaults` and `codemode.examples`. These are the ones that make a deck look wrong:

- `style.color` defaults to `#111827` and does not follow `theme.foreground`. On a dark background, set `style.color`.
- A Markdown `#` heading is drawn at 1.3em of `style.fontSize`. `#` plus 72px is about 94px. For a 64–80px title, omit `#` or lower `fontSize`.
- `setBibliography({ source })` embeds BibTeX. A short `@misc` entry is enough. Put `[@key]` in the citing text, set `bibliography: true` on one slide, and use `citationFormat: "#sup{@number}"` when the marker should be a superscript number.
- `hidePageNumber: true` also hides the progress bar.
- An `entrance` animation stays visible in the editor and is hidden until the click only in presentation mode.
- `progress`, `titleBox`, `listBox`, `shadow`, and `transition` are objects. `progress: true` throws and saves nothing. Copy the objects in the reference script.
- Morph needs the same `name` on exactly two slides, and `transition: { type: "morph" }` only on the second. The same name twice on one slide does not morph. A repeated name on any later slide, including a kicker, links those objects.
- Unknown `style` keys are rejected. `execute` reports the error and leaves the file unchanged.
- `script` and `scene` on a Manim element are optional. Omit `script`, or use a short path. An empty string is rejected. Until it is rendered, the placeholder label is that path.
