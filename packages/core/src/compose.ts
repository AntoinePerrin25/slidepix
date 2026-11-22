import type { Deck, Slide, SlideElement } from "./schema.js";
import { syncVectors, type VectorModel } from "./vector.js";

export type PlaceholderMode = "prompt" | "blank";

/** Connector geometry follows anchors. Callers that paint a deck should use a copy when the source must stay unchanged. */
export function syncDeckGeometry(deck: Deck): void {
  for (const slide of deck.slides) syncElementVectors(slide.elements);
  for (const layout of Object.values(deck.layouts)) syncElementVectors(layout.elements);
  for (const component of Object.values(deck.components)) syncElementVectors(component.elements);
}

export function syncElementVectors(elements: SlideElement[]): void {
  const vectors = elements.filter((element): element is Extract<SlideElement, { type: "vector" }> => element.type === "vector");
  syncVectors(vectors as VectorModel[], elements);
}

/** Connector geometry for painting. The input array is not mutated. `boxes` can include hidden targets the paint list omits. */
export function vectorsForPaint(elements: readonly SlideElement[], boxes: readonly SlideElement[] = elements): SlideElement[] {
  const copy = elements.map((element) => element.type === "vector" && element.kind === "connector"
    ? { ...element, from: element.from ? { ...element.from } : undefined, to: element.to ? { ...element.to } : undefined }
    : element);
  const vectors = copy.filter((element): element is Extract<SlideElement, { type: "vector" }> => element.type === "vector");
  syncVectors(vectors as VectorModel[], boxes);
  return copy;
}

export function paintLayoutElements(slide: Slide, layout: Deck["layouts"][string] | undefined, mode: PlaceholderMode): SlideElement[] {
  if (!layout) return [];
  return layout.elements.map((element) => applyPlaceholder(element, slide.slots[element.id], mode));
}

export function applyPlaceholder(element: SlideElement, slot: Slide["slots"][string] | undefined, mode: PlaceholderMode): SlideElement {
  if (!element.placeholder) return element;
  if (element.type === "text") {
    const authored = slot?.markdown !== undefined ? slot.markdown : element.markdown;
    const markdown = authored.trim() ? authored : mode === "prompt" ? element.placeholder.prompt : "";
    return markdown === element.markdown ? element : { ...element, markdown };
  }
  if (element.type === "image" && slot?.src) {
    return { ...element, src: slot.src, storage: slot.storage ?? element.storage };
  }
  return element;
}

export function isPlaceholderImage(element: SlideElement): boolean {
  return element.type === "image" && element.placeholder !== undefined && element.src === "placeholder";
}

export function elementCollections(deck: Deck): SlideElement[][] {
  return [
    ...deck.slides.map((slide) => slide.elements),
    ...Object.values(deck.layouts).map((layout) => layout.elements),
    ...Object.values(deck.components).map((component) => component.elements)
  ];
}
