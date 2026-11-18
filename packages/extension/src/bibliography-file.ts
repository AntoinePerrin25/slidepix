import { readFile } from "node:fs/promises";
import { resolveMediaPath } from "@slidepix/core/assets";

export async function readLinkedBibliography(deckPath: string, reference: string, allowedLinkedRoots: string[]): Promise<string> {
  const file = reference.trim();
  if (!file) return "";
  try {
    return await readFile(resolveMediaPath(deckPath, file, "linked", allowedLinkedRoots), "utf8");
  } catch {
    return "";
  }
}
