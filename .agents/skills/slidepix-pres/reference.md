# SlidePix execute API

`search` code reads `codemode`. `execute` code reads `codemode` and calls `slidepix`. Both must return JSON. There is no `apply` tool.

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
