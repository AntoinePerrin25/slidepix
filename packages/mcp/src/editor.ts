import { randomUUID } from "node:crypto";
import {
  animationStepSchema,
  deckSchema,
  duplicateElementOntoFollowingSlides,
  elementSchema,
  parseDeckText,
  type Deck,
  type Slide,
  type SlideElement
} from "@slidepix/core";

const FONT = "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif";

export interface SlidepixEditor {
  api: Record<string, (...args: unknown[]) => unknown>;
  snapshot(): Deck;
}

export function createEditor(initial: Deck): SlidepixEditor {
  let deck = cloneDeck(initial);
  const commit = (mutate: (draft: Deck) => unknown): unknown => {
    const draft = cloneDeck(deck);
    const value = mutate(draft);
    deck = validate(draft);
    return value;
  };

  const api: Record<string, (...args: unknown[]) => unknown> = {
    deck: () => ({
      title: deck.metadata.title,
      author: deck.metadata.author,
      size: deck.size,
      theme: deck.theme,
      slideCount: deck.slides.length,
      header: deck.header.enabled ? deck.header.text : "",
      footer: deck.footer.enabled ? deck.footer.text : ""
    }),
    slides: () => deck.slides.map((slide, index) => ({
      id: slide.id,
      index: index + 1,
      title: slide.title,
      hidden: slide.hidden,
      bibliography: slide.bibliography,
      elementCount: slide.elements.length
    })),
    slide: (ref: unknown) => viewSlide(deck, resolveSlide(deck, ref)),
    addSlide: (input?: unknown) => commit((draft) => addSlide(draft, object(input ?? {}, "addSlide"))),
    updateSlide: (ref: unknown, patch: unknown) => commit((draft) => updateSlide(draft, ref, object(patch, "updateSlide patch"))),
    removeSlide: (ref: unknown) => commit((draft) => removeSlide(draft, ref)),
    addElement: (ref: unknown, input: unknown) => commit((draft) => addElement(draft, ref, object(input, "addElement"))),
    updateElement: (ref: unknown, elementId: unknown, patch: unknown) => commit((draft) => updateElement(draft, ref, elementId, object(patch, "updateElement patch"))),
    removeElement: (ref: unknown, elementId: unknown) => commit((draft) => removeElement(draft, ref, elementId)),
    duplicateFollowing: (ref: unknown, elementId: unknown, every?: unknown) => commit((draft) => {
      const slide = resolveSlide(draft, ref);
      const id = stringArg(elementId, "element id");
      if (!slide.elements.some((element) => element.id === id)) throw new Error(`Unknown element ID: ${id}`);
      const step = every === undefined ? undefined : positiveInteger(every, "every");
      duplicateElementOntoFollowingSlides(draft, slide.id, id, step);
      return { elementId: id, every: step ?? 1 };
    }),
    setMetadata: (patch: unknown) => commit((draft) => {
      Object.assign(draft.metadata, pick(object(patch, "setMetadata"), ["title", "author", "description"]));
      return { title: draft.metadata.title };
    }),
    setTheme: (patch: unknown) => commit((draft) => {
      Object.assign(draft.theme, pick(object(patch, "setTheme"), ["background", "foreground", "accent", "fontFamily"]));
      return draft.theme;
    }),
    setHeader: (patch: unknown) => commit((draft) => assignChrome(draft.header, object(patch, "setHeader"))),
    setFooter: (patch: unknown) => commit((draft) => assignChrome(draft.footer, object(patch, "setFooter"))),
    setPageNumbers: (patch: unknown) => commit((draft) => {
      const value = object(patch, "setPageNumbers");
      const { progress, ...rest } = value;
      Object.assign(draft.pageNumbers, pick(rest, ["enabled", "format", "color", "fontSize", "align", "x", "y", "width", "height"]));
      if (progress !== undefined) Object.assign(draft.pageNumbers.progress, object(progress, "progress"));
      return { enabled: draft.pageNumbers.enabled };
    }),
    setBibliography: (patch: unknown) => commit((draft) => {
      const value = object(patch, "setBibliography");
      const { titleBox, listBox, ...rest } = value;
      Object.assign(draft.bibliography, pick(rest, ["file", "storage", "source", "title", "format", "citationFormat", "indent"]));
      if (titleBox !== undefined) Object.assign(draft.bibliography.titleBox, object(titleBox, "titleBox"));
      if (listBox !== undefined) Object.assign(draft.bibliography.listBox, object(listBox, "listBox"));
      return { title: draft.bibliography.title };
    }),
    addAnimation: (ref: unknown, input: unknown) => commit((draft) => addAnimation(draft, ref, object(input, "addAnimation"))),
    defineLayout: (input: unknown) => commit((draft) => defineCollection(draft, "layouts", object(input, "defineLayout"))),
    defineComponent: (input: unknown) => commit((draft) => defineCollection(draft, "components", object(input, "defineComponent"))),
    applyLayout: (ref: unknown, layoutId: unknown) => commit((draft) => {
      const slide = resolveSlide(draft, ref);
      if (layoutId === null || layoutId === "") { delete slide.layout; return { id: slide.id }; }
      const id = stringArg(layoutId, "layout id");
      if (!draft.layouts[id]) throw new Error(`Unknown layout: ${id}`);
      slide.layout = id;
      return { id: slide.id, layout: id };
    }),
    setSlot: (ref: unknown, elementId: unknown, patch: unknown) => commit((draft) => setSlot(draft, ref, elementId, object(patch, "setSlot")))
  };

  return { api, snapshot: () => cloneDeck(deck) };
}

function addSlide(deck: Deck, input: Record<string, unknown>): { id: string; index: number } {
  const created: Slide = {
    id: randomUUID(),
    title: typeof input.title === "string" ? input.title : "Untitled slide",
    notes: typeof input.notes === "string" ? input.notes : "",
    hidden: false,
    bibliography: input.bibliography === true,
    hidePageNumber: false,
    transition: { type: "none", durationMs: 500, easing: "ease-in-out", ...(input.transition && typeof input.transition === "object" ? input.transition as Slide["transition"] : {}) },
    timeline: [],
    slots: {},
    elements: []
  };
  if (typeof input.background === "string") created.background = input.background;
  const after = input.after === undefined ? deck.slides.length : indexOf(deck, input.after) + 1;
  deck.slides.splice(after, 0, created);
  return { id: created.id, index: after + 1 };
}

function updateSlide(deck: Deck, ref: unknown, patch: Record<string, unknown>): { id: string } {
  const slide = resolveSlide(deck, ref);
  const { transition, backgroundImage, layout, ...rest } = pick(patch, ["title", "notes", "hidden", "bibliography", "hidePageNumber", "background", "backgroundImage", "transition", "layout"]);
  Object.assign(slide, rest);
  if (transition !== undefined) slide.transition = { ...slide.transition, ...object(transition, "transition") };
  if (backgroundImage === null) delete slide.backgroundImage;
  else if (backgroundImage !== undefined) slide.backgroundImage = object(backgroundImage, "backgroundImage") as Slide["backgroundImage"];
  if (layout === null || layout === "") delete slide.layout;
  else if (typeof layout === "string") {
    if (!deck.layouts[layout]) throw new Error(`Unknown layout: ${layout}`);
    slide.layout = layout;
  }
  return { id: slide.id };
}

function removeSlide(deck: Deck, ref: unknown): { id: string } {
  if (deck.slides.length < 2) throw new Error("A deck must keep at least one slide.");
  const index = indexOf(deck, ref);
  const [removed] = deck.slides.splice(index, 1);
  return { id: removed!.id };
}

function addElement(deck: Deck, ref: unknown, input: Record<string, unknown>): { id: string } {
  const slide = resolveSlide(deck, ref);
  const element = elementSchema.parse(elementInput(input));
  slide.elements.push(element);
  return { id: element.id };
}

function updateElement(deck: Deck, ref: unknown, elementId: unknown, patch: Record<string, unknown>): { id: string } {
  const slide = resolveSlide(deck, ref);
  const id = stringArg(elementId, "element id");
  const index = slide.elements.findIndex((element) => element.id === id);
  const current = slide.elements[index];
  if (!current) throw new Error(`Unknown element ID: ${id}`);
  const next = { ...current, ...pick(patch, ["x", "y", "width", "height", "rotation", "opacity", "z", "locked", "hidden", "name", "alt", "markdown", "src", "storage", "poster", "shape", "fill", "stroke", "strokeWidth", "borderRadius", "edgeFade", "rows", "columns", "cells", "headerRow", "script", "scene", "output", "orientation", "quality", "lockAspectRatio", "parentId", "kind", "d", "svg", "markerStart", "markerEnd", "routing", "chart", "categories", "series", "legend", "valueLabels", "componentId"]) };
  for (const key of ["from", "to", "dataLink", "placeholder"] as const) {
    if (patch[key] !== undefined) (next as Record<string, unknown>)[key] = patch[key];
  }
  for (const key of ["style", "crop", "border", "shadow", "playback"] as const) {
    if (patch[key] !== undefined && key in current) {
      (next as Record<string, unknown>)[key] = { ...(current as unknown as Record<string, unknown>)[key] as object, ...object(patch[key], key) };
    }
  }
  slide.elements[index] = elementSchema.parse(next);
  return { id };
}

function removeElement(deck: Deck, ref: unknown, elementId: unknown): { id: string } {
  const slide = resolveSlide(deck, ref);
  const id = stringArg(elementId, "element id");
  const index = slide.elements.findIndex((element) => element.id === id);
  if (index < 0) throw new Error(`Unknown element ID: ${id}`);
  const removed = new Set([id]);
  const walk = (parentId: string) => { for (const element of slide.elements) if (element.parentId === parentId) { removed.add(element.id); walk(element.id); } };
  walk(id);
  slide.elements = slide.elements.filter((element) => !removed.has(element.id)).map((element) => {
    if (element.parentId && removed.has(element.parentId)) delete element.parentId;
    if (element.type === "vector") {
      if (element.from?.elementId && removed.has(element.from.elementId)) delete element.from.elementId;
      if (element.to?.elementId && removed.has(element.to.elementId)) delete element.to.elementId;
    }
    if (element.type === "chart" && element.dataLink && removed.has(element.dataLink.elementId)) delete element.dataLink;
    return element;
  });
  slide.timeline = slide.timeline.filter((step) => !removed.has(step.targetElementId));
  return { id };
}

function addAnimation(deck: Deck, ref: unknown, input: Record<string, unknown>): { id: string } {
  const slide = resolveSlide(deck, ref);
  const step = animationStepSchema.parse({ id: randomUUID(), phase: "entrance", effect: "fade", trigger: "onClick", delayMs: 0, durationMs: 500, easing: "ease-out", ...input });
  slide.timeline.push(step);
  return { id: step.id };
}

function elementInput(input: Record<string, unknown>): Record<string, unknown> {
  const type = input.type;
  if (typeof type !== "string") throw new Error("addElement requires a type.");
  const base = {
    id: typeof input.id === "string" ? input.id : randomUUID(),
    morphKey: typeof input.morphKey === "string" ? input.morphKey : randomUUID(),
    x: numberOr(input.x, 96),
    y: numberOr(input.y, 140),
    width: numberOr(input.width, 800),
    height: numberOr(input.height, 140),
    rotation: numberOr(input.rotation, 0),
    opacity: numberOr(input.opacity, 1),
    z: numberOr(input.z, 1),
    locked: input.locked === true,
    hidden: input.hidden === true,
    name: typeof input.name === "string" ? input.name : undefined,
    alt: typeof input.alt === "string" ? input.alt : undefined,
    parentId: typeof input.parentId === "string" ? input.parentId : undefined,
    placeholder: input.placeholder && typeof input.placeholder === "object" ? input.placeholder : undefined,
    type
  };
  if (type === "text") {
    return { ...base, markdown: typeof input.markdown === "string" ? input.markdown : "", style: { fontFamily: FONT, fontSize: 40, fontWeight: 400, color: "#111827", textAlign: "left", verticalAlign: "top", lineHeight: 1.25, padding: 8, ...object(input.style ?? {}, "style") } };
  }
  if (type === "shape") {
    return { ...base, shape: input.shape ?? "rectangle", fill: input.fill ?? "#2563eb", stroke: input.stroke ?? "transparent", strokeWidth: numberOr(input.strokeWidth, 0), borderRadius: numberOr(input.borderRadius, 0), shadow: { enabled: false, color: "#00000040", offsetX: 0, offsetY: 12, blur: 24, ...object(input.shadow ?? {}, "shadow") } };
  }
  if (type === "image" || type === "video") {
    return { ...base, src: input.src, storage: input.storage ?? "linked", crop: { x: 0, y: 0, width: 1, height: 1, ...object(input.crop ?? {}, "crop") }, borderRadius: numberOr(input.borderRadius, 0), edgeFade: numberOr(input.edgeFade, 0), border: { width: 0, color: "transparent" }, lockAspectRatio: input.lockAspectRatio !== false, poster: input.poster, playback: { mode: "manual", muted: false, loop: false, controls: true, ...object(input.playback ?? {}, "playback") } };
  }
  if (type === "table") {
    return { ...base, rows: numberOr(input.rows, 3), columns: numberOr(input.columns, 3), cells: Array.isArray(input.cells) ? input.cells : [], headerRow: input.headerRow !== false, style: object(input.style ?? {}, "style") };
  }
  if (type === "manim") {
    return { ...base, width: numberOr(input.width, 1280), height: numberOr(input.height, 720), script: input.script, scene: input.scene, output: input.output ?? "image", orientation: input.orientation ?? "horizontal", quality: input.quality ?? "medium", lockAspectRatio: input.lockAspectRatio !== false, playback: { mode: "manual", muted: false, loop: false, controls: true } };
  }
  if (type === "vector") {
    return { ...base, kind: input.kind ?? "path", d: typeof input.d === "string" ? input.d : "M 8 50 L 92 50", svg: typeof input.svg === "string" ? input.svg : "", fill: input.fill ?? "transparent", stroke: input.stroke ?? "#111827", strokeWidth: numberOr(input.strokeWidth, 4), markerStart: input.markerStart ?? "none", markerEnd: input.markerEnd ?? (input.kind === "connector" ? "arrow" : "none"), routing: input.routing ?? "straight", from: input.from, to: input.to, parentId: input.parentId };
  }
  if (type === "group") return { ...base, parentId: input.parentId };
  if (type === "component") return { ...base, componentId: input.componentId, parentId: input.parentId };
  if (type === "chart") {
    return { ...base, chart: input.chart ?? "bar", categories: Array.isArray(input.categories) ? input.categories : ["A", "B", "C"], series: Array.isArray(input.series) ? input.series : [{ name: "Series", values: [1, 2, 3] }], legend: input.legend !== false, valueLabels: input.valueLabels === true, dataLink: input.dataLink, parentId: input.parentId };
  }
  throw new Error(`Unknown element type: ${type}`);
}

function defineCollection(deck: Deck, key: "layouts" | "components", input: Record<string, unknown>): { id: string } {
  const id = typeof input.id === "string" && input.id ? input.id : randomUUID();
  const elements = Array.isArray(input.elements) ? input.elements.map((item) => elementSchema.parse(elementInput(object(item, "element")))) : [];
  if (key === "layouts") deck.layouts[id] = { name: typeof input.name === "string" ? input.name : "Layout", background: typeof input.background === "string" ? input.background : undefined, elements };
  else deck.components[id] = { name: typeof input.name === "string" ? input.name : "Component", width: numberOr(input.width, 640), height: numberOr(input.height, 360), elements };
  return { id };
}

function setSlot(deck: Deck, ref: unknown, elementId: unknown, patch: Record<string, unknown>): { id: string } {
  const slide = resolveSlide(deck, ref);
  const layout = slide.layout ? deck.layouts[slide.layout] : undefined;
  if (!layout) throw new Error("This slide has no layout.");
  const id = stringArg(elementId, "placeholder id");
  if (!layout.elements.some((element) => element.id === id && element.placeholder)) throw new Error(`Unknown placeholder: ${id}`);
  const slot = { ...slide.slots[id] };
  if (typeof patch.markdown === "string") slot.markdown = patch.markdown;
  if (typeof patch.src === "string") slot.src = patch.src;
  if (patch.storage === "linked" || patch.storage === "embedded") slot.storage = patch.storage;
  slide.slots[id] = slot;
  return { id };
}

function viewSlide(deck: Deck, slide: Slide) {
  return {
    id: slide.id,
    index: deck.slides.findIndex((item) => item.id === slide.id) + 1,
    title: slide.title,
    notes: slide.notes,
    hidden: slide.hidden,
    bibliography: slide.bibliography,
    layout: slide.layout ?? "",
    transition: slide.transition,
    elements: slide.elements.map(viewElement)
  };
}

function viewElement(element: SlideElement) {
  const common = { id: element.id, name: element.name ?? "", type: element.type, x: element.x, y: element.y, width: element.width, height: element.height, z: element.z, hidden: element.hidden, parentId: element.parentId ?? "" };
  if (element.type === "text") return { ...common, markdown: element.markdown.slice(0, 800), placeholder: element.placeholder?.role ?? "" };
  if (element.type === "shape") return { ...common, shape: element.shape, fill: element.fill };
  if (element.type === "image" || element.type === "video") return { ...common, src: element.src, storage: element.storage };
  if (element.type === "table") return { ...common, rows: element.rows, columns: element.columns };
  if (element.type === "vector") return { ...common, kind: element.kind, markerEnd: element.markerEnd };
  if (element.type === "group") return common;
  if (element.type === "component") return { ...common, componentId: element.componentId };
  if (element.type === "chart") return { ...common, chart: element.chart, categories: element.categories, series: element.series.map((series) => series.name) };
  if (element.type === "manim") return { ...common, output: element.output, scene: element.scene ?? "" };
  return common;
}

function assignChrome(target: Deck["header"], patch: Record<string, unknown>) {
  Object.assign(target, pick(patch, ["enabled", "text", "color", "fontSize", "align", "x", "y", "width", "height"]));
  return { enabled: target.enabled, text: target.text };
}

function resolveSlide(deck: Deck, ref: unknown): Slide {
  return deck.slides[indexOf(deck, ref)]!;
}

function indexOf(deck: Deck, ref: unknown): number {
  if (typeof ref === "number" && Number.isInteger(ref)) {
    if (ref < 1 || ref > deck.slides.length) throw new Error(`Slide index ${ref} is out of range.`);
    return ref - 1;
  }
  if (typeof ref === "string" && ref) {
    const index = deck.slides.findIndex((slide) => slide.id === ref);
    if (index < 0) throw new Error(`Unknown slide ID: ${ref}`);
    return index;
  }
  throw new Error("A slide reference must be an id or a 1-based index.");
}

function validate(draft: Deck): Deck {
  const parsed = parseDeckText(JSON.stringify(draft));
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.deck;
}

function cloneDeck(deck: Deck): Deck {
  return deckSchema.parse(structuredClone(deck));
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    result[key] = item;
  }
  return result;
}

function pick(source: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) if (key in source) result[key] = source[key];
  return result;
}

function stringArg(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) throw new Error(`${label} must be a string.`);
  return value;
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer.`);
  return value;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
