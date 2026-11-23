# SlidePix deck format

This document records storage invariants. The executable definition is
`packages/core/src/schema.ts`; when prose and code disagree, the schema is the
current behavior and the documentation should be corrected.

## Files

A deck named `talk.slidepix.json` can link media inside the open workspace or
store portable copies in `talk.assets/`:

```text
talk.slidepix.json
talk.assets/
  1ad8…e3.png
  a772…19.mp4
```

New files chosen from or dropped out of the VS Code/Cursor Explorer use
`storage: "linked"` by default and keep a POSIX-style path relative to the deck.
They may resolve only inside an open workspace root. **Embed in .assets** and
the toolbar's **Embed all** command copy linked media into the sibling asset
directory and change the element to `storage: "embedded"`.

Embedded assets are named by SHA-256 content hash plus a safe extension, which
deduplicates identical media. Embedded references resolve only inside the asset
directory. Absolute paths, NUL bytes, and traversal outside the applicable
root are rejected. Decks created before `storage` existed parse as `embedded`
for backward compatibility.

## Coordinates and identity

- Default slide size is 1920×1080 logical units; custom positive dimensions
  are valid.
- New decks default to a white background, dark foreground, blue accent, and a
  portable system UI font stack. Existing decks keep their persisted theme.
- `(0, 0)` is the top-left corner. Positive X moves right; positive Y moves
  down.
- IDs are stable non-empty strings. New objects currently use UUIDs.
- Element `id` identifies one concrete object. Morph matches a trimmed
  `name` that is unique among the visible elements on its slide. A blank name,
  or the same name twice on one slide, does not morph. `morphKey` stays in the
  file for compatibility and is not the match.
- Slide duplication generates a new slide ID and new element IDs, preserves
  element names and morph keys, and clears the animation timeline.

## Version and validation

`schemaVersion` is currently `1`. A higher version is rejected explicitly so an
older extension cannot silently discard fields. Malformed or schema-invalid
manual edits produce diagnostics and leave the last valid visual preview
untouched in memory; the error screen remains visible until valid source is
saved. Invalid source is not overwritten by the webview.

Serialization uses two-space JSON indentation and one final newline. All writes
pass through the Zod schema, which also fills declared defaults.

Validation also requires unique slide, element, and animation IDs. Every
animation target must exist on its slide, and every slide layout reference must
name a persisted layout.

## Git merge semantics

The optional SlidePix Git driver performs a three-way merge by stable entity
ID. One-sided edits, identical edits, different properties, different table
cells, and concurrent additions merge automatically. When both branches insert
into the same ordered gap, each branch's order is retained and the current
branch's additions come first.

Delete-versus-edit, different values for the same property, and incompatible
two-sided reorders remain conflicts. A one-sided reorder is accepted. Every
clean or interactively resolved result is validated and serialized canonically;
invalid inputs fall back to ordinary Git conflict markers.

## Top-level model

- `metadata`: title, author, and description.
- `size`: logical width and height.
- `theme`: deck background, foreground, accent, and default font family.
- `pageNumbers`: whether a number is shown, its format (`{n}` and `{total}`),
  color, size, alignment, and box. An optional progress bar has its own color,
  thickness, and box. `header` and `footer` are the same kind of text box and
  stay off until enabled.
- `bibliography`: a reference file (`linked` beside the deck, or `embedded` in
  the deck `.assets` folder), the BibTeX `source` kept in the deck, the title
  shown on a tagged slide, a bibliography-list format, an in-slide citation
  format, and the number of spaces inserted for `#indent`. The list defaults
  to Chicago author-date. `[@key]` defaults to `(@shortauthor @year)`, the
  family names and year. `@author` keeps the names as written in the file.
  `@number` follows the first appearance of each cited key, from the top of
  each visible slide downward. The bibliography slide lists only those cited
  entries, in that same order. `#sup{...}` is a small superscript and
  `#small{...}` is smaller text in slide text. `titleBox` and `listBox` place
  the bibliography title and the citation list. `source` is merged by citation
  key.
- `layouts`: reusable named backgrounds and elements. A slide's `layout` id
  paints that definition behind its own elements. `slide.slots` overrides a
  placeholder by the layout element's id (`markdown`, or `src` and `storage`).
- `components`: reusable objects. Each definition has a local width, height,
  and elements in component coordinates. A `component` element on a slide or
  layout is one instance and scales that definition into its box.
- `slides`: at least one ordered slide.

A slide contains its title, optional layout/background color, optional
`backgroundImage` (`src` plus explicit linked/embedded storage), speaker notes,
hidden state, an optional bibliography tag, `hidePageNumber` for that slide,
incoming transition, animation timeline,
and ordered elements. Background images stretch to the exact logical slide
rectangle in every renderer and export. A bibliography slide lists the deck's
reference file. Text can cite an entry with `[@citation-key]`; the in-slide
citation format decides whether that marker shows a number, the author, the
date, or another token.

Element types are `text`, `image`, `video`, `manim`, `shape`, `table`, `vector`,
`group`, `component`, and `chart`. Shared geometry fields
are `x`, `y`, `width`, `height`, `rotation`, `opacity`, and `z`; shared behavior
includes locking, hiding, optional name, optional accessibility text, and an
optional `parentId` that must name a group in the same slide, layout, or
component. A `placeholder` (`role` and `prompt`) marks a layout element that a
slide can fill.

A `vector` is a `path` (`d` in a 0–100 box), a `connector` (`from` and `to`,
each a point with an optional `elementId` and `anchor`, plus `routing` of
`straight`, `elbow`, or `curve`), or one `svg` document. Markers are `none` or
`arrow`. An `svg` value must be a single `<svg>` element and cannot contain
scripts, embedded images, or event handlers. A `group` has no paint of its own;
its members stay in the same element list. A `chart` is `bar`, `line`, `area`,
or `pie`, with `categories` and `series`, or a `dataLink` to a table in the same
collection. The table's header names the series and its first column names the
categories.
Image and video elements also carry `storage: "linked" | "embedded"`; the
`src` string alone is never enough to decide its security boundary. Optional
`lockAspectRatio` defaults to on. `aspectRatio` is the ratio of the current
media frame (width divided by height): new media starts at its source ratio,
while cropping updates it to the cropped frame ratio. The flag constrains
interactive resizing; parsing and saving never rewrite stored geometry.

A `manim` element stores a workspace-linked `script` path (POSIX relative to
the deck), optional `scene` class name, `output` (`image` or `video`),
`orientation` (`horizontal` for 16:9 or `vertical` for 9:16; the host passes
matching `--resolution` and `--transparent` to Manim on render), `quality`
(`low`, `medium`, `high`, or `production`), optional `transparent` background,
optional embedded `outputMedia` produced by the extension host, and video
`playback` settings when `output` is `video`. The `.py` source stays linked in
the workspace. Rendered JPEG/MP4/WebM bytes are embedded in `talk.assets/`
under a persistent name `deck-scene` (the deck file stem and the scene class).
The slide title is not part of the name. Elements that share the same script,
scene, output, orientation, quality, and transparency share that file, including
a copy on the next slide, so morph reuses one image. A different render whose
name collides gets a numeric suffix. Re-rendering overwrites that file. Manim
writes a still as PNG; the host converts it to JPEG afterwards. A transparent
still stays PNG, because JPEG has no alpha channel.

Text paints past its box. The slide still clips at its own edges. Tab characters
in Markdown stay as tab stops. `style.lineHeight` is the spacing within a
paragraph. A blank line separates blocks with a `0.5em` margin on each side.

Shape fills and strokes accept CSS colors including the literal `transparent`.
A shape also stores a shadow object (`enabled`, color, X/Y offset, and blur);
older shapes receive a disabled shadow through schema defaults. Tables store
bounded row/column counts, a Markdown cell matrix, an optional header row, and
typography/fill/border style. Renderers treat missing cells as empty, while the
editor's row/column actions normalize the matrix before it is saved.

See [Core module](modules/core.md) for parser and serializer method contracts.
