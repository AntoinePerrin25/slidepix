# SlidePix execute API

`search` code reads `codemode`, including `defaults` and `examples`. `execute` code calls `slidepix` and returns JSON. There is no `apply` tool. Do not open the extension source. A failed `execute` does not write the file.

`style.color` defaults to `#111827` and ignores `theme.foreground`. A `#` heading is 1.3em of `fontSize`. `bibliography.source` is embedded BibTeX. `src` is not checked at save time. `manim.script` and `scene` are optional; an unrendered script is shown in full on the placeholder, so keep it empty or a short path. `hidePageNumber` also hides the progress bar. Entrance steps hide only while presenting.

## One execute

A new deck already contains slide 1, titled "Title slide", with one `#` heading at 72px in `#111827`. The script below removes that element, then sets the chrome and the slides. Paste it, then change the strings. These values are objects; a boolean throws and saves nothing:

- `progress`: `{ enabled, color, thickness, x, y, width }`
- `titleBox` and `listBox`: `{ x, y, width, height }`
- `shadow`: `{ enabled, color, offsetX, offsetY, blur }`
- `transition`: `{ type, durationMs, easing }`
- text `style`: `fontSize`, `fontWeight`, `color`, `textAlign`, `verticalAlign`, `lineHeight`, `padding`
- table `style` also accepts `headerFill`, `cellFill`, `borderColor`, `borderWidth`
- `cells`: an array of arrays of strings, not one markdown grid

`addSlide` and `addElement` return `{ id }`. Pass that id to `addAnimation`. `direction` is `left`, `right`, `up`, or `down`, and only applies to `fly`. On a dark theme, set `style.color`, the table fills, `progress.color`, and the header and footer colors. A morph `name` exists on exactly two slides; only the second uses `type: "morph"`.

```javascript
slidepix.setMetadata({ title: "Claim", author: "" });
slidepix.setTheme({ background: "#0b1020", foreground: "#f8fafc", accent: "#f97316" });
slidepix.setHeader({ enabled: true, text: "Claim", color: "#94a3b8", fontSize: 24, align: "left", x: 96, y: 28, width: 1200, height: 48 });
slidepix.setFooter({ enabled: true, text: "SlidePix", color: "#94a3b8", fontSize: 24, align: "left", x: 96, y: 1008, width: 1200, height: 48 });
slidepix.setPageNumbers({
  enabled: true, format: "{n}", color: "#94a3b8", fontSize: 24, align: "right",
  x: 1520, y: 1012, width: 304, height: 48,
  progress: { enabled: true, color: "#f97316", thickness: 8, x: 96, y: 1064, width: 1728 }
});
slidepix.setBibliography({
  source: "@misc{slidepix, title = {SlidePix}, author = {SlidePix}, year = {2026}}",
  title: "References",
  citationFormat: "#sup{@number}",
  indent: 24,
  titleBox: { x: 96, y: 96, width: 1728, height: 80 },
  listBox: { x: 96, y: 220, width: 1728, height: 700 }
});

const opening = slidepix.slide(1);
for (const element of opening.elements) slidepix.removeElement(1, element.id);
slidepix.updateSlide(1, { title: "Opening", transition: { type: "fade", durationMs: 400 } });
slidepix.addElement(1, {
  type: "text", name: "opener", markdown: "Claim",
  x: 96, y: 360, width: 1728, height: 160,
  style: { fontSize: 72, fontWeight: 700, color: "#f8fafc", textAlign: "left" }
});

const body = slidepix.addSlide({ title: "Evidence", transition: { type: "fade", durationMs: 400 } });
slidepix.addElement(body.id, {
  type: "text", name: "evidence",
  markdown: "One claim.\n\n- **Bold** and $E = mc^2$\n- Source [@slidepix]",
  x: 96, y: 140, width: 1728, height: 320,
  style: { fontSize: 36, color: "#f8fafc" }
});
slidepix.addElement(body.id, {
  type: "table", name: "grid",
  x: 96, y: 500, width: 1728, height: 400,
  rows: 2, columns: 2, headerRow: true,
  cells: [["Item", "Value"], ["A", "1"]],
  style: { fontSize: 28, color: "#f8fafc", headerFill: "#1e293b", cellFill: "#0f172a", borderColor: "#334155" }
});

const before = slidepix.addSlide({ title: "Before", transition: { type: "fade", durationMs: 400 } });
slidepix.addElement(before.id, {
  type: "shape", name: "card", shape: "rectangle", fill: "#f97316",
  x: 96, y: 400, width: 480, height: 280, borderRadius: 24,
  shadow: { enabled: true, color: "#00000066", offsetX: 0, offsetY: 12, blur: 24 }
});
const after = slidepix.addSlide({ title: "After", transition: { type: "morph", durationMs: 500 } });
slidepix.addElement(after.id, {
  type: "shape", name: "card", shape: "rectangle", fill: "#f97316",
  x: 1200, y: 240, width: 620, height: 420, borderRadius: 24,
  shadow: { enabled: true, color: "#00000066", offsetX: 0, offsetY: 12, blur: 24 }
});

const motion = slidepix.addSlide({ title: "Steps", transition: { type: "fade", durationMs: 400 } });
const step = slidepix.addElement(motion.id, {
  type: "text", name: "step", markdown: "Appears on click",
  x: 96, y: 400, width: 1200, height: 120,
  style: { fontSize: 40, color: "#f8fafc" }
});
slidepix.addAnimation(motion.id, {
  targetElementId: step.id, phase: "entrance", effect: "fly", trigger: "onClick", direction: "left"
});

const diagram = slidepix.addSlide({ title: "Diagram", transition: { type: "fade", durationMs: 400 } });
slidepix.addElement(diagram.id, {
  type: "manim", name: "diagram", script: "scenes/intro.py", scene: "Intro", output: "image",
  x: 320, y: 180, width: 1280, height: 720
});
slidepix.addSlide({ title: "References", bibliography: true, transition: { type: "fade", durationMs: 400 } });
return slidepix.slides().map((slide) => slide.title);
```

| Call | Effect |
| --- | --- |
| `slidepix.deck()` | Title, size, theme, and slide count. |
| `slidepix.slides()` | Id, 1-based index, title, hidden, bibliography, element count. |
| `slidepix.slide(ref)` | Notes, transition, and compact elements. Text markdown is truncated to 800 characters. |
| `slidepix.addSlide({ title, after, notes, bibliography, background, transition })` | Inserts after `after`, or at the end. |
| `slidepix.updateSlide(ref, patch)` | `title`, `notes`, `hidden`, `bibliography`, `hidePageNumber`, `background`, `backgroundImage`, `transition`. |
| `slidepix.removeSlide(ref)` | Refuses to remove the last slide. |
| `slidepix.addElement(ref, input)` | `input.type` is `text`, `shape`, `image`, `video`, `table`, or `manim`. Omitted geometry and style fields get defaults. |
| `slidepix.updateElement(ref, elementId, patch)` | Moves, restyles, or rewrites one element. Nested `style`, `crop`, `border`, `shadow`, and `playback` merge. |
| `slidepix.removeElement(ref, elementId)` | Also removes animations that target it. |
| `slidepix.duplicateFollowing(ref, elementId, every?)` | Every later slide, or every nth slide counted from the current one. |
| `slidepix.setMetadata({ title, author, description })` | Deck metadata. |
| `slidepix.setTheme({ background, foreground, accent, fontFamily })` | Deck theme. |
| `slidepix.setHeader(patch)` / `setFooter(patch)` | `enabled`, `text`, `color`, `fontSize`, `align`, and the box. |
| `slidepix.setPageNumbers(patch)` | Same box fields plus `format` (`{n}`, `{total}`) and `progress`. |
| `slidepix.setBibliography(patch)` | `file`, `storage`, `source`, `title`, `format`, `citationFormat`, `indent`, `titleBox`, `listBox`. |
| `slidepix.addAnimation(ref, input)` | `targetElementId`, `phase` (`entrance` or `exit`), `effect` (`appear`, `fade`, `fly`), `trigger`, optional `direction`. |

Element fields worth setting:

- text: `markdown`, `name`, `style.fontSize`, `style.fontWeight`, `style.color`, `style.textAlign`
- shape: `shape` (`rectangle`, `ellipse`, `triangle`), `fill`, `stroke`, `strokeWidth`, `borderRadius`
- image and video: `src`, `storage` (`linked` or `embedded`), `playback.mode` (`autoplay` or `manual`)
- table: `rows`, `columns`, `cells` as an array of markdown rows, `headerRow`
- manim: `script`, `scene`, `output` (`image` or `video`)

Transitions: `none`, `fade`, `slide-left`, `slide-right`, `slide-up`, `slide-down`, `morph`.

Citation tokens inside formats: `@author`, `@shortauthor`, `@year`, `@title`, `@url`, `@number`, `#sup{...}`, `#small{...}`, `#indent`.
