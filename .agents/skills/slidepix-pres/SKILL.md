---
name: slidepix-pres
description: Author or revise a SlidePix presentation in a .slidepix.json deck. Use when creating slides, editing slide text, layout, citations, headers, footers, or morphs, or when an agent is about to generate a Python or Node script that writes the deck JSON.
---

# Author a SlidePix presentation

The SlidePix MCP server has four tools: `list_slides`, `inspect_slides`, `search`, and `execute`. There is no `apply` tool. A call to that name returns "Tool not found".

`search` reads the authoring catalog in `codemode` and does not touch a deck. `execute` edits one `.slidepix.json` file. Do not write a Python or Node script. Do not send an `operations` array.

## Edit

1. Require an absolute `*.slidepix.json` path. Pass `create: true` only when the file does not exist yet.
2. Call `search` when a field name is uncertain. `codemode` is the catalog, not the deck.
3. Call `execute` with JavaScript that uses `slidepix` and `return`s a small JSON value. `ref` is a slide id or a 1-based index.
4. Read the returned `result`. If the call throws, fix the code and run it again. A failed call does not save.
5. A read-only `execute` reports `changed: false` and does not rewrite the file.

```javascript
const first = slidepix.slides()[0];
slidepix.addElement(first.id, {
  type: "text", name: "title", markdown: "# Claim",
  x: 96, y: 180, width: 1728, height: 160,
  style: { fontSize: 72, fontWeight: 700 }
});
return slidepix.slides();
```

`list_slides` and `inspect_slides` stay read-only. Use them to review a deck, not to author one.

For the method list and element fields, read [reference.md](reference.md).

## Slide design

- The canvas is 1920×1080 unless `slidepix.deck().size` says otherwise. `(0, 0)` is the top left. Keep a 96-unit margin.
- One claim per slide. A title around 64–80px, body around 32–40px, and at least two lines of space between them.
- Text is Markdown: headings, lists, `**bold**`, `$LaTeX$`, and `[@key]`.
- Higher `z` paints above. Give the repeated object the same unique `name` on two slides when it should morph.
- Header, footer, and page numbers are deck-wide. `setHeader` and `setFooter` move them on every slide.
- Put `[@key]` in the text that cites it. Mark one slide with `bibliography: true`. The list contains only keys that appear, numbered by first appearance from the top of each visible slide.
- `addElement` for an image or video stores a path; it does not copy the file. Use a workspace-relative `src` with `storage: "linked"`, or an existing hash name with `storage: "embedded"`.
