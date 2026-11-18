import { readFile } from "node:fs/promises";
import type { Deck } from "@slidepix/core";
import { resolveMediaPath } from "@slidepix/core/assets";

/** The synced bibliography text, or the referenced file when the deck has not copied it yet. */
export async function readDeckBibliography(deckPath: string, bibliography: Deck["bibliography"], allowedLinkedRoots: string[]): Promise<string> {
  if (bibliography.source) return bibliography.source;
  const file = bibliography.file.trim();
  if (!file) return "";
  try {
    return await readFile(resolveMediaPath(deckPath, file, bibliography.storage, allowedLinkedRoots), "utf8");
  } catch {
    return "";
  }
}
