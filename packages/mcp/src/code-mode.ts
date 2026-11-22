import { randomBytes } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createDeck, serializeDeck } from "@slidepix/core";
import { createEditor } from "./editor.js";
import { runGuestCode } from "./sandbox.js";
import { loadDeck } from "./tools.js";

export async function searchCatalog(code: string): Promise<unknown> {
  return runGuestCode(code).result;
}

export async function executeDeck(deckPath: string, code: string, create = false): Promise<{ changed: boolean; result: unknown; logs: string[] }> {
  const file = deckFile(deckPath);
  const original = await readDeckText(file, create);
  const loaded = original === undefined ? createDeck("Untitled deck") : await loadDeck(file);
  const editor = createEditor(loaded);
  const { result, logs } = runGuestCode(code, editor.api);
  const next = serializeDeck(editor.snapshot());
  const changed = original === undefined || next !== serializeDeck(loaded);
  if (changed) await replaceDeck(file, original, next);
  return { changed, result, logs };
}

function deckFile(deckPath: string): string {
  if (!path.isAbsolute(deckPath)) throw new Error("deckPath must be an absolute path.");
  if (!deckPath.endsWith(".slidepix.json")) throw new Error("deckPath must be a .slidepix.json file.");
  return path.resolve(deckPath);
}

async function readDeckText(file: string, create: boolean): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if (create && (error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function replaceDeck(file: string, original: string | undefined, next: string): Promise<void> {
  if (original !== undefined && await readFile(file, "utf8") !== original) {
    throw new Error("The deck changed while the edit was running. Read it again and retry.");
  }
  const temporary = `${file}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(temporary, next);
  await rename(temporary, file);
}
