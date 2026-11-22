import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDeck, parseDeckText, serializeDeck } from "@slidepix/core";
import { executeDeck, searchCatalog } from "./code-mode";
import { runGuestCode } from "./sandbox";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("code mode", () => {
  it("returns catalog fields without a deck", async () => {
    const fields = await searchCatalog("return codemode.elements.text.fields");
    expect(fields).toContain("markdown");
    expect(await searchCatalog("return codemode.defaults.textColor")).toBe("#111827");
    expect(await searchCatalog("return codemode.examples.bibliography.source")).toContain("@misc");
    expect(await searchCatalog("return typeof slidepix")).toBe("undefined");
  });

  it("edits a deck through the slidepix API and leaves a read unchanged", async () => {
    const file = await deckFile();
    const edited = await executeDeck(file, `
      const slide = slidepix.slides()[0];
      slidepix.addElement(slide.id, { type: "text", name: "title", markdown: "# Hello", x: 96, y: 180, width: 1728, height: 160, style: { fontSize: 72, fontWeight: 700 } });
      slidepix.addSlide({ title: "Next", after: slide.id });
      slidepix.addSlide({ title: "After" });
      slidepix.duplicateFollowing(slide.id, slidepix.slide(slide.id).elements.find((item) => item.name === "title").id, 2);
      return slidepix.slides();
    `);
    expect(edited.changed).toBe(true);
    const parsed = parseDeckText(await readFile(file, "utf8"));
    if (!parsed.ok) throw new Error(parsed.message);
    expect(parsed.deck.slides).toHaveLength(3);
    expect(parsed.deck.slides[0]!.elements.some((element) => element.type === "text" && element.markdown === "# Hello")).toBe(true);
    expect(parsed.deck.slides[1]!.elements).toHaveLength(0);
    expect(parsed.deck.slides[2]!.elements).toHaveLength(1);
    const before = await readFile(file, "utf8");
    const read = await executeDeck(file, "return slidepix.deck().title");
    expect(read.changed).toBe(false);
    expect(await readFile(file, "utf8")).toBe(before);
  });

  it("does not save an invalid edit", async () => {
    const file = await deckFile();
    const before = await readFile(file, "utf8");
    await expect(executeDeck(file, "slidepix.addElement(1, { type: 'image' }); return true")).rejects.toThrow();
    expect(await readFile(file, "utf8")).toBe(before);
  });

  it("creates a missing deck and keeps host process out of the guest", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "slidepix-code-"));
    directories.push(directory);
    const file = path.join(directory, "new.slidepix.json");
    const created = await executeDeck(file, "slidepix.setMetadata({ title: 'Created' }); return slidepix.deck().title", true);
    expect(created).toMatchObject({ changed: true, result: "Created" });
    expect(() => runGuestCode("return slidepix.deck.constructor('return process.version')()", {
      deck: () => ({ title: "x" })
    })).toThrow();
  });
});

async function deckFile(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "slidepix-code-"));
  directories.push(directory);
  const file = path.join(directory, "talk.slidepix.json");
  await writeFile(file, serializeDeck(createDeck("Untitled deck")));
  return file;
}
