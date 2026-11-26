import path from "node:path";
import { isPlaceholderImage } from "./compose.js";
import type { Deck, MediaStorage, SlideElement } from "./schema.js";

export type DeckMediaReference = { reference: string; storage: MediaStorage };

export function mediaReferenceKey(reference: string, storage: MediaStorage): string {
  return `${storage}\0${reference}`;
}

/** Media the deck actually points at. Hidden slides and elements are skipped unless requested. */
export function deckMediaReferences(deck: Deck, options?: { includeHidden?: boolean }): Map<string, DeckMediaReference> {
  const includeHidden = options?.includeHidden ?? false;
  const references = new Map<string, DeckMediaReference>();
  const add = (reference: string, storage: MediaStorage) => {
    if (!reference.trim()) return;
    references.set(mediaReferenceKey(reference, storage), { reference, storage });
  };
  const addElement = (element: SlideElement) => {
    if (element.hidden && !includeHidden) return;
    if (isPlaceholderImage(element)) return;
    if (element.type === "manim") {
      if (element.outputMedia) add(element.outputMedia.src, element.outputMedia.storage);
      return;
    }
    if (element.type === "chart" && element.sheet?.source) {
      add(element.sheet.source.src, element.sheet.source.storage);
      return;
    }
    if (element.type !== "image" && element.type !== "video") return;
    add(element.src, element.storage);
    if (element.type === "video" && element.poster) add(element.poster, "embedded");
  };
  if (deck.bibliography.file.trim()) add(deck.bibliography.file, deck.bibliography.storage);
  for (const layout of Object.values(deck.layouts)) {
    if (layout.backgroundImage) add(layout.backgroundImage.src, layout.backgroundImage.storage);
    for (const element of layout.elements) addElement(element);
  }
  for (const component of Object.values(deck.components)) for (const element of component.elements) addElement(element);
  for (const slide of deck.slides) {
    if (slide.hidden && !includeHidden) continue;
    if (slide.backgroundImage) add(slide.backgroundImage.src, slide.backgroundImage.storage);
    for (const slot of Object.values(slide.slots)) if (slot.src && slot.storage && slot.src !== "placeholder") add(slot.src, slot.storage);
    for (const element of slide.elements) addElement(element);
  }
  return references;
}

export function deckAssetDirectory(deckPath: string): string {
  const suffix = ".slidepix.json";
  const base = deckPath.endsWith(suffix) ? deckPath.slice(0, -suffix.length) : deckPath;
  return `${base}.assets`;
}

export function normalizeAssetReference(reference: string): string {
  return reference.replaceAll("\\", "/").replace(/^\.\//, "");
}

export function resolveAssetPath(deckPath: string, reference: string): string {
  const normalized = normalizeAssetReference(reference);
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0")) {
    throw new Error("Asset path must be relative");
  }
  const root = path.resolve(deckAssetDirectory(deckPath));
  const resolved = path.resolve(root, normalized);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Asset path escapes the deck asset directory");
  }
  return resolved;
}

export function resolveMediaPath(
  deckPath: string,
  reference: string,
  storage: MediaStorage = "embedded",
  allowedLinkedRoots: string[] = [path.dirname(deckPath)]
): string {
  if (storage === "embedded") return resolveAssetPath(deckPath, reference);
  const normalized = normalizeAssetReference(reference);
  if (!normalized || normalized.startsWith("/") || /^[a-z]:\//i.test(normalized) || normalized.includes("\0")) {
    throw new Error("Linked media path must be relative");
  }
  const resolved = path.resolve(path.dirname(deckPath), normalized);
  const roots = allowedLinkedRoots.map((root) => path.resolve(root));
  if (!roots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`))) {
    throw new Error("Linked media path escapes the allowed workspace roots");
  }
  return resolved;
}
