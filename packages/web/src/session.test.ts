import { describe, expect, it } from "vitest";
import { parseDeckText, serializeDeck } from "@slidepix/core";
import { applyWebMessage, createWebSession } from "./session.js";

const assetBase = "https://slides.example/slidepix/media/";
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("browser deck host", () => {
  it("opens a demo deck and keeps a previously stored one", async () => {
    const created = await createWebSession();
    const ready = await applyWebMessage(created, { version: 2, type: "ready" }, assetBase);
    expect(ready.changed).toBe(true);
    expect(ready.replies[0]).toMatchObject({ type: "deck", surface: "web", uri: assetBase });
    if (ready.replies[0]?.type !== "deck") throw new Error("expected a deck");
    expect(ready.replies[0].deck.metadata.title).toBe("SlidePix");

    const stored = await createWebSession({ text: created.text, history: created.history, assets: created.assets });
    const reloaded = await applyWebMessage(stored, { version: 2, type: "ready" }, assetBase);
    expect(reloaded.changed).toBe(false);
    expect(reloaded.replies[0]).toMatchObject({ type: "deck", text: created.text });
  });

  it("accepts a replacement only for the current revision", async () => {
    const session = await createWebSession();
    const ready = await applyWebMessage(session, { version: 2, type: "ready" }, assetBase);
    if (ready.replies[0]?.type !== "deck") throw new Error("expected a deck");
    const stale = await applyWebMessage(session, {
      version: 2,
      type: "replaceDocument",
      requestId: "stale",
      baseRevision: "other-revision",
      text: session.text
    }, assetBase);
    expect(stale.changed).toBe(false);
    expect(stale.replies[0]).toMatchObject({ type: "documentEditResult", accepted: false, reason: "stale", revision: ready.replies[0].revision });

    const parsed = parseDeckText(session.text);
    if (!parsed.ok) throw new Error(parsed.message);
    parsed.deck.metadata.title = "Edited";
    const text = serializeDeck(parsed.deck);
    const replaced = await applyWebMessage(session, {
      version: 2,
      type: "replaceDocument",
      requestId: "edit",
      baseRevision: ready.replies[0].revision,
      text
    }, assetBase);
    expect(replaced.changed).toBe(true);
    expect(replaced.replies[0]).toMatchObject({ type: "documentEditResult", accepted: true, canUndo: true, canRedo: false });
    expect(session.text).toBe(text);
  });

  it("undoes one accepted edit", async () => {
    const session = await createWebSession();
    const original = session.text;
    const ready = await applyWebMessage(session, { version: 2, type: "ready" }, assetBase);
    if (ready.replies[0]?.type !== "deck") throw new Error("expected a deck");
    const parsed = parseDeckText(session.text);
    if (!parsed.ok) throw new Error(parsed.message);
    parsed.deck.metadata.title = "Edited";
    await applyWebMessage(session, {
      version: 2,
      type: "replaceDocument",
      requestId: "edit",
      baseRevision: ready.replies[0].revision,
      text: serializeDeck(parsed.deck)
    }, assetBase);
    const undone = await applyWebMessage(session, { version: 2, type: "history", requestId: "undo", command: "undo" }, assetBase);
    expect(undone.replies[0]).toMatchObject({ type: "historyResult", ok: true, command: "undo", canUndo: false, canRedo: true });
    expect(session.text).toBe(original);
  });

  it("stores an imported image as embedded media", async () => {
    const session = await createWebSession();
    const imported = await applyWebMessage(session, {
      version: 2,
      type: "importAsset",
      requestId: "asset",
      name: "dot.png",
      mime: "image/png",
      base64: png
    }, assetBase);
    expect(imported.writtenAssets).toHaveLength(1);
    expect(imported.replies[0]).toMatchObject({ type: "assetImported", requestId: "asset", storage: "embedded" });
    if (imported.replies[0]?.type !== "assetImported" || !imported.replies[0].reference) throw new Error("expected a reference");
    expect(imported.replies[0].reference).toMatch(/^[a-f0-9]{64}\.png$/);
    expect(session.assets.get(imported.replies[0].reference)?.mime).toBe("image/png");
  });

  it("downloads the deck and its embedded assets as a project zip", async () => {
    const session = await createWebSession();
    const exported = await applyWebMessage(session, { version: 2, type: "command", command: "exportProject", requestId: "project" }, assetBase);
    expect(exported.replies[0]).toMatchObject({ type: "notify", notificationId: "project", status: "success" });
    expect(exported.effects[0]).toMatchObject({ type: "download", filename: "deck.zip" });
    if (exported.effects[0]?.type !== "download") throw new Error("expected a download");
    expect(exported.effects[0].href.startsWith("data:application/zip;base64,")).toBe(true);
  });

  it("builds a presentation document from the current deck", async () => {
    const session = await createWebSession();
    const presented = await applyWebMessage(session, { version: 2, type: "command", command: "present" }, assetBase);
    expect(presented.effects[0]).toMatchObject({ type: "present" });
    if (presented.effects[0]?.type !== "present") throw new Error("expected a presentation");
    expect(presented.effects[0].html).toContain("mode-present");
    expect(presented.effects[0].html).toContain("SlidePix");
  });
});
