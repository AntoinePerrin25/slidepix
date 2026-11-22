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
  morph: "Set the same unique element name on both slides. A blank name does not morph. The same name twice on one slide does not morph. A name repeated on a later slide, including a small kicker, links those objects.",
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
    { name: "addAnimation", signature: "slidepix.addAnimation(ref, { targetElementId, phase, effect, trigger, direction, delayMs, durationMs })" },
    { name: "defineLayout", signature: "slidepix.defineLayout({ id?, name, background, elements })", note: "elements use the same input as addElement. Text, image, and chart elements can set placeholder: { role, prompt }." },
    { name: "defineComponent", signature: "slidepix.defineComponent({ id?, name, width, height, elements })", note: "element coordinates are local to the component box. A component cannot contain another component." },
    { name: "applyLayout", signature: "slidepix.applyLayout(ref, layoutId | null)" },
    { name: "setSlot", signature: "slidepix.setSlot(ref, placeholderId, { markdown?, src?, storage? })", note: "fills one layout placeholder on that slide" }
  ],
  defaults: {
    textColor: "#111827",
    textColorFollowsTheme: false,
    headingEm: { h1: 1.3, h2: 1.15, h3: 1 },
    hidePageNumberAlsoHidesProgress: true,
    entranceHiddenOnlyWhilePresenting: true,
    unknownStyleKeysRejected: true
  },
  examples: {
    darkTheme: { background: "#0b1020", foreground: "#f8fafc", accent: "#f97316", textColor: "#f8fafc" },
    title: { markdown: "Claim", fontSize: 72, note: "A leading # is drawn at 1.3em, so # plus fontSize 72 is about 94px" },
    bibliography: {
      source: "@misc{slidepix, title = {SlidePix}, author = {SlidePix}, year = {2026}}",
      citationFormat: "#sup{@number}",
      marker: "[@slidepix]",
      slide: { bibliography: true }
    },
    morph: { name: "card" },
    animation: { phase: "entrance", effect: "fade", trigger: "onClick" }
  },
  elements: {
    text: {
      fields: ["markdown", "x", "y", "width", "height", "name", "z", "style.fontSize", "style.fontWeight", "style.color", "style.textAlign", "style.verticalAlign", "style.lineHeight"],
      markdown: "headings, lists, **bold**, *italic*, $LaTeX$, [@key]",
      color: "style.color defaults to #111827 and does not follow theme.foreground. Set it on a dark background."
    },
    shape: { fields: ["shape", "fill", "stroke", "strokeWidth", "borderRadius", "shadow"], shape: ["rectangle", "ellipse", "triangle"] },
    image: { fields: ["src", "storage", "crop", "lockAspectRatio", "borderRadius"], storage: ["linked", "embedded"], note: "src is a non-empty string. Saving does not check that the file exists and does not copy bytes. A missing file is stored, then broken at display." },
    video: { fields: ["src", "storage", "poster", "playback.mode", "playback.muted", "playback.loop"], playback: ["autoplay", "manual"], note: "Same src rule as image." },
    table: { fields: ["rows", "columns", "cells", "headerRow", "style"], note: "cells are markdown strings" },
    manim: { fields: ["script", "scene", "output", "orientation", "quality"], optional: ["script", "scene"], output: ["image", "video"], note: "Without a render, the editor shows a placeholder labeled with the script string. Leave script empty or use a short path; do not paste a long script into the label." },
    vector: { fields: ["kind", "d", "svg", "fill", "stroke", "strokeWidth", "markerStart", "markerEnd", "routing", "from", "to"], kind: ["path", "connector", "svg"], routing: ["straight", "elbow", "curve"], note: "path d uses a 0–100 box. connector from/to may set elementId and anchor (center, top, right, bottom, left). svg must be one safe <svg> document." },
    group: { fields: ["parentId"], note: "Members point at the group with parentId. Groups can contain groups." },
    component: { fields: ["componentId"], note: "An instance of a component created with defineComponent." },
    chart: { fields: ["chart", "categories", "series", "legend", "valueLabels", "dataLink"], chart: ["bar", "line", "area", "pie"], note: "dataLink: { elementId } reads a table on the same slide. Otherwise series is [{ name, values }]." }
  },
  transitions: ["none", "fade", "slide-left", "slide-right", "slide-up", "slide-down", "morph"],
  effects: ["appear", "fade", "fly"],
  triggers: ["onClick", "withPrevious", "afterPrevious"]
} as const;
