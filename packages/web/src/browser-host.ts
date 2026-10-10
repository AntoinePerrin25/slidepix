import type { WebviewToHostMessage } from "@slidepix/core";
import { matchesMediaKind } from "./bytes.js";
import { MEDIA_PATH } from "./paths.js";
import { applyWebMessage, createWebSession, storeMedia, type WebEffect, type WebHostResult, type WebSession } from "./session.js";
import { clearWebAssets, loadWebDeck, saveWebAsset, saveWebDeck } from "./storage.js";

declare global {
  interface Window {
    acquireVsCodeApi?: () => {
      postMessage(message: WebviewToHostMessage): void;
      getState(): unknown;
      setState(state: unknown): void;
    };
  }
}

export async function startBrowserHost(): Promise<void> {
  const stored = await loadWebDeck();
  let session = await createWebSession(stored);
  let chain = Promise.resolve();
  const assetBase = new URL(MEDIA_PATH, window.location.origin).toString();

  const handle = (message: WebviewToHostMessage) => {
    const presentation = message.type === "command" && message.command === "present" ? window.open("", "_blank") : null;
    chain = chain.then(() => dispatch(message, presentation)).catch((error: unknown) => {
      presentation?.close();
      console.error(error);
    });
  };

  window.acquireVsCodeApi = () => ({
    postMessage: handle,
    getState: () => undefined,
    setState: () => undefined
  });

  async function dispatch(message: WebviewToHostMessage, presentation: Window | null): Promise<void> {
    const result = await applyWebMessage(session, message, assetBase);
    const picks = result.effects.filter((effect): effect is Extract<WebEffect, { type: "pickMedia" }> => effect.type === "pickMedia");
    const immediate = { ...result, effects: result.effects.filter((effect) => effect.type !== "pickMedia" && effect.type !== "present") };
    await persist(session, immediate);
    deliver(immediate);
    for (const effect of result.effects) {
      if (effect.type === "present") showPresentation(presentation, effect.html);
    }
    for (const effect of picks) void completePick(effect);
  }

  async function completePick(effect: Extract<WebEffect, { type: "pickMedia" }>): Promise<void> {
    const file = await pickMedia(effect.kind);
    chain = chain.then(async () => {
      if (!file) {
        deliver(idleReply([{ version: 2, type: "assetImported", requestId: effect.requestId }]));
        return;
      }
      if (!matchesMediaKind(file.name, file.type, effect.kind)) {
        deliver(idleReply([{ version: 2, type: "assetImported", requestId: effect.requestId, error: `Choose a supported ${effect.kind} file.` }]));
        return;
      }
      const imported = await storeMedia(session, effect.requestId, file.name, file.type, { bytes: new Uint8Array(await file.arrayBuffer()) });
      await persist(session, imported);
      deliver(imported);
    }).catch((error: unknown) => {
      console.error(error);
    });
  }
}

async function persist(session: WebSession, result: WebHostResult): Promise<void> {
  if (result.clearAssets) await clearWebAssets();
  for (const reference of result.writtenAssets) {
    const asset = session.assets.get(reference);
    if (asset) await saveWebAsset(reference, asset);
  }
  if (result.changed || result.clearAssets) await saveWebDeck(session);
}

function deliver(result: WebHostResult): void {
  for (const reply of result.replies) window.postMessage(reply, window.location.origin);
  for (const effect of result.effects) runEffect(effect);
}

function idleReply(replies: WebHostResult["replies"]): WebHostResult {
  return { changed: false, clearAssets: false, writtenAssets: [], replies, effects: [] };
}

function runEffect(effect: WebEffect): void {
  if (effect.type === "log") {
    if (effect.level === "error") console.error(effect.message);
    else if (effect.level === "warn") console.warn(effect.message);
    else console.info(effect.message);
    return;
  }
  if (effect.type === "download") {
    const anchor = document.createElement("a");
    anchor.href = effect.href;
    anchor.download = effect.filename;
    anchor.click();
  }
}

function showPresentation(preview: Window | null, html: string): void {
  if (!preview) {
    window.postMessage({
      version: 2,
      type: "notify",
      notificationId: crypto.randomUUID(),
      status: "error",
      message: "The browser blocked the presentation window."
    }, window.location.origin);
    return;
  }
  preview.document.open();
  preview.document.write(html);
  preview.document.close();
}

function pickMedia(kind: "image" | "video"): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = kind === "image" ? "image/*" : "video/*";
    let settled = false;
    const finish = (file?: File) => {
      if (settled) return;
      settled = true;
      resolve(file);
    };
    input.addEventListener("change", () => finish(input.files?.[0]));
    input.addEventListener("cancel", () => finish());
    input.click();
  });
}
