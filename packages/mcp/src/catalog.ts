/** Compact authoring catalog. `search` runs guest code against this object. */
export const codemodeCatalog = {
  coordinates: {
    origin: "top-left",
    x: "right",
    y: "down",
    defaultSize: { width: 1920, height: 1080 },
    margin: 96
  },
  citations: {
    marker: "[@key]",
    number: "first appearance from the top of each visible slide downward",
    bibliographySlide: "set slide.bibliography true; the list contains only referenced keys",
    tokens: ["@author", "@shortauthor", "@year", "@title", "@url", "@number", "#sup{...}", "#small{...}", "#indent"]
  },
  morph: "Set the same unique element name on both slides. A blank or repeated name does not morph.",
  operations: [
    { name: "deck", signature: "slidepix.deck()", returns: "title, size, theme, counts" },
    { name: "slides", signature: "slidepix.slides()", returns: "id, 1-based index, title, hidden, element count" },
    { name: "slide", signature: "slidepix.slide(ref)", returns: "slide fields and a compact element list" },
    { name: "addSlide", signature: "slidepix.addSlide({ title, after, notes, bibliography, transition })", returns: "id and 1-based index" },
    { name: "updateSlide", signature: "slidepix.updateSlide(ref, patch)", patch: ["title", "notes", "hidden", "bibliography", "hidePageNumber", "background", "backgroundImage", "transition"] },
    { name: "removeSlide", signature: "slidepix.removeSlide(ref)", note: "the last slide cannot be removed" },
    { name: "addElement", signature: "slidepix.addElement(ref, input)", note: "input.type is required; omitted geometry and style fields receive defaults" },
    { name: "updateElement", signature: "slidepix.updateElement(ref, elementId, patch)", note: "nested style, crop, border, shadow, and playback objects merge" },
    { name: "removeElement", signature: "slidepix.removeElement(ref, elementId)" },
    { name: "duplicateFollowing", signature: "slidepix.duplicateFollowing(ref, elementId, every?)", note: "omit every to copy onto each later slide; otherwise copy every nth slide counted from the current one" },
    { name: "setMetadata", signature: "slidepix.setMetadata({ title, author, description })" },
    { name: "setTheme", signature: "slidepix.setTheme({ background, foreground, accent, fontFamily })" },
    { name: "setHeader", signature: "slidepix.setHeader({ enabled, text, color, fontSize, align, x, y, width, height })" },
    { name: "setFooter", signature: "slidepix.setFooter({ enabled, text, color, fontSize, align, x, y, width, height })" },
    { name: "setPageNumbers", signature: "slidepix.setPageNumbers({ enabled, format, color, fontSize, align, x, y, width, height, progress })" },
    { name: "setBibliography", signature: "slidepix.setBibliography({ file, storage, source, title, format, citationFormat, indent, titleBox, listBox })" },
    { name: "addAnimation", signature: "slidepix.addAnimation(ref, { targetElementId, phase, effect, trigger, direction, delayMs, durationMs })" }
  ],
  elements: {
    text: {
      fields: ["markdown", "x", "y", "width", "height", "name", "z", "style.fontSize", "style.fontWeight", "style.color", "style.textAlign", "style.verticalAlign", "style.lineHeight"],
      markdown: "headings, lists, **bold**, *italic*, $LaTeX$, [@key]"
    },
    shape: { fields: ["shape", "fill", "stroke", "strokeWidth", "borderRadius", "shadow"], shape: ["rectangle", "ellipse", "triangle"] },
    image: { fields: ["src", "storage", "crop", "lockAspectRatio", "borderRadius"], storage: ["linked", "embedded"], note: "src must already exist; this API does not copy bytes" },
    video: { fields: ["src", "storage", "poster", "playback.mode", "playback.muted", "playback.loop"], playback: ["autoplay", "manual"] },
    table: { fields: ["rows", "columns", "cells", "headerRow", "style"], note: "cells are markdown strings" },
    manim: { fields: ["script", "scene", "output", "orientation", "quality"], output: ["image", "video"] }
  },
  transitions: ["none", "fade", "slide-left", "slide-right", "slide-up", "slide-down", "morph"],
  effects: ["appear", "fade", "fly"],
  triggers: ["onClick", "withPrevious", "afterPrevious"]
} as const;
