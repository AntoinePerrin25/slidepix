# Changelog

## 0.2.0

### Editing

- Add in-place Markdown editing. Double-click a text box, or select it and press Enter or F2. Escape or Ctrl/Cmd+Enter finishes. Bold, italic, and lists apply to the current selection. The advanced editor keeps a live preview for LaTeX and highlighted code.
- Add a compact PowerPoint-style ribbon that collapses to icons when the editor is narrow. Insert text, images, video, shapes, tables, and Manim stills or videos from the toolbar.
- Shift-click to multi-select. Align to the page or the selection, center on the page, and distribute three or more unlocked items. Dragging one selected item moves the unlocked selection. Hold Shift to snap to other items and the slide edges.
- Copy and paste elements between slides with a typed clipboard. A copy onto another slide keeps its morph name.
- Drag slide thumbnails to reorder them. Insert a slide between two slides, and apply one incoming transition to every slide.
- Zoom with Ctrl/Cmd+wheel and the canvas zoom controls. Collapse speaker notes, the slide rail, and the inspector without changing the deck.
- Undo and redo from the toolbar or the keyboard while the editor has focus. Typing, nudging, and dragging group into single steps.
- Pick a font from the operating system with **System fonts…**. New text uses the system UI font.
- Put the editable element name first in Properties. Animation cards show that name, the click group, the effect, and the timeline order.
- Batch-edit shapes that share a name. Color, size, and pose copy onto the matching shapes on the other slides.
- Add tables with a header row, cell Markdown, and transparent header, cell, and border colors. Shapes can use a transparent fill or stroke and an optional shadow.
- Lock image, video, and Manim boxes to their aspect ratio. Cropping updates that ratio to the cropped frame.
- Paint text past its box while the slide still clips at the page edge. Set paragraph line height, and keep tab stops in Markdown and table cells.
- Choose or remove a slide background image. It stretches to the slide in the editor, presentation, and exports.
- Add a deck-wide header, footer, page numbers, and an optional progress bar. Header, footer, and pagination start collapsed in the inspector. **Hide pagination on this slide** suppresses the number and the bar on one slide.
- Duplicate an element onto later slides on a chosen interval and keep its morph name.
- Create a deck beside the Explorer selection. A taken `untitled.slidepix.json` becomes `untitled-2.slidepix.json`, and so on.

### Media

- Link workspace images and videos by a relative path, including files dropped from the Explorer. **Embed in .assets** and **Embed all** copy them into the deck asset folder when the deck must travel alone.
- Show images in slide thumbnails. Set a border, corner radius, and a four-sided edge fade that follows rounded corners in the editor and in exports.
- Drag on-canvas radius and fade handles. Double-click an image to crop it: pan, wheel zoom, ratio-locked corners, a zoom slider, and reset.

### Presentation

- Advance entrance animations before changing slides. Previous and next restore a completed animation state or the initial state.
- Pause video when leaving a slide or hiding the presentation.
- Double-buffer presenter previews so the current and next slides do not flash black.

### Export

- Capture PDF and PNG in the editor. Each PNG is the exact slide size. The PDF page count matches the visible slides, and both exports keep negative-z text and the same syntax highlighting as the canvas.
- Show a video in PDF and PNG as its first frame with a play control. The PDF does not contain a playable stream.
- Add **Export Project**. The zip contains the deck, its `.assets` folder, and the linked media needed to reopen it. When the deck has rendered Manim media, the export asks whether to include those files.

### Manim

- Add a Manim element linked to a workspace `.py` script. It renders a still image or a video.
- Choose the scene, 16:9 or 9:16 orientation, quality, and a transparent background. **Render** and **Render all** run ready scenes together, up to one process per CPU core, with batch and per-scene progress. The full Manim log goes to the SlidePix output channel.
- Name rendered media from the deck file and the scene class. Matching elements share that file, including a copy used for a morph. A transparent still stays PNG; other stills are converted to JPEG.
- Add **Set up Manim** to browse for an executable, install uv and Manim Community, or create a Python 3.12 virtual environment beside the deck. An empty setting uses `.venv/bin/manim` or `.venv/Scripts/manim.exe` only when that file exists.

### Bibliography

- Cite a BibTeX file from slide text, tables, and a slide tagged as the bibliography. `[@citation-key]` uses the in-slide format. The default is the family names and the year. The bibliography slide lists only the cited entries, in first-appearance order from the top of each visible slide downward.
- Format the list, the in-slide marker, and `#indent`. `#sup{...}` and `#small{...}` set a superscript or smaller text. **Copy bibliography** copies the displayed title and the cited entries.
- Keep the reference file linked beside the deck or embedded in `.assets`. Git and live collaboration merge citation entries by key.

### Live collaboration

- Add **Share** and **SlidePix: Join Live Collaboration**. The host's deck stays the saved document. Guests edit a mirror and can save a local copy. The host approves each guest unless approval is turned off. The invitation secret has to match, and three failures ban that peer for the session.
- Connect with encrypted QUIC. A direct path is preferred, and relay bytes stay encrypted. Relays can stay on, be replaced, or be disabled. At most eight guests can join.
- Show peer initials, slide presence, remote selections, and a ghost while someone else drags. A soft lock keeps two people out of the same text. Guests receive the media the deck references and upload new media into the host asset folder.
- Keep keystrokes typed after a rejected guest edit. Manim runs only on the host. There is no character-level text merge and no view-only role. Intel macOS has no live-collaboration binary; the editor still opens.

### Distribution

- Publish the extension as **SlidePix Deck**.
- Add `pnpm publish:all` and `pnpm publish:ovsx` so one build can publish each platform target to the Marketplace and Open VSX.

## 0.1.0

- Initial editor, presentation, export, and MCP release.
- Add standalone offline web-folder export with copied content-addressed media.
- Add direct native PowerPoint export with editable rich text, code, OfficeMath,
  shapes, tables, pictures, video, speaker notes, transitions, Morph matching,
  timeline animations, safe media resolution, and approximation reporting.
- Preserve Markdown surrounding inline equations and keep syntax-coloured code
  tokens together across multi-line PowerPoint paragraphs.
- Add revision-safe multi-panel persistence, ID-aware Git merging, stronger deck
  integrity validation, repository-local Git setup/removal, and semantic
  conflict resolution.
