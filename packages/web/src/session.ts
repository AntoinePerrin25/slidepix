import {
  createDeck,
  parseDeckText,
  renderDeckDocument,
  serializeDeck,
  type Deck,
  type HostToWebviewMessage,
  type WebviewToHostMessage
} from "@slidepix/core";
import {
  emptyDocumentHistory,
  historyFlags,
  recordDocumentEdit,
  redoDocument,
  undoDocument,
  type DocumentHistory,
  type HistoryStep
} from "../../extension/src/document-history";
import { bytesToBase64, decodeBase64, embeddedReference, MAX_MEDIA_BYTES } from "./bytes.js";
import { storedZip } from "./stored-zip.js";
import { revisionForText } from "./revision.js";

export type StoredAsset = { mime: string; bytes: Uint8Array };

export type WebSession = {
  text: string;
  history: DocumentHistory;
  assets: Map<string, StoredAsset>;
  /** True until the first ready is persisted for a deck that was not loaded. */
  fresh: boolean;
};

export type WebEffect =
  | { type: "present"; html: string }
  | { type: "download"; filename: string; href: string }
  | { type: "pickMedia"; requestId: string; kind: "image" | "video" }
  | { type: "log"; level: "info" | "warn" | "error"; message: string };

export type WebHostResult = {
  changed: boolean;
  clearAssets: boolean;
  writtenAssets: string[];
  replies: HostToWebviewMessage[];
  effects: WebEffect[];
};

const desktopOnly = "This action is available in the VS Code and Cursor editor.";

export async function createWebSession(stored?: {
  text?: string;
  history?: DocumentHistory;
  assets?: Map<string, StoredAsset>;
}): Promise<WebSession> {
  const usableHistory = historySteps(stored?.history);
  return {
    text: stored?.text ?? serializeDeck(createDeck("SlidePix")),
    history: usableHistory,
    assets: stored?.assets ?? new Map(),
    fresh: stored?.text === undefined
  };
}

export async function applyWebMessage(session: WebSession, message: WebviewToHostMessage, assetBase: string): Promise<WebHostResult> {
  if (message.version !== 2) {
    return idle({ effects: [{ type: "log", level: "error", message: "Rejected a SlidePix message from another protocol version." }] });
  }
  switch (message.type) {
    case "ready":
      return publish(session, assetBase, session.fresh);
    case "resetDeck":
      session.text = serializeDeck(createDeck("SlidePix"));
      session.history = emptyDocumentHistory();
      session.assets = new Map();
      session.fresh = false;
      return publish(session, assetBase, true, true);
    case "replaceDocument":
      return replaceDocument(session, message.requestId, message.baseRevision, message.text);
    case "history":
      return applyHistory(session, message.command, message.requestId);
    case "importAsset":
      return storeMedia(session, message.requestId, message.name, message.mime, decodeMedia(message.base64));
    case "selectMedia":
      return idle({ effects: [{ type: "pickMedia", requestId: message.requestId, kind: message.kind }] });
    case "linkMedia":
      return idle({ replies: [assetReply(message.requestId, undefined, "Linked workspace files are available in the desktop editor. Choose a file to embed it instead.")] });
    case "embedMedia":
    case "setupManim":
      return idle({ replies: [notice(message.type === "setupManim" ? "manim-setup" : crypto.randomUUID(), "error", desktopOnly)] });
    case "selectFont":
      return idle({ replies: [{ version: 2, type: "fontSelected", requestId: message.requestId, error: desktopOnly }] });
    case "selectManimScript":
      return idle({ replies: [{ version: 2, type: "manimScriptSelected", requestId: message.requestId, error: desktopOnly }] });
    case "createManimScript":
      return idle({ replies: [{ version: 2, type: "manimScriptCreated", requestId: message.requestId, error: desktopOnly }] });
    case "openManimScript":
      return idle({ effects: [{ type: "log", level: "warn", message: desktopOnly }] });
    case "listManimScenes":
      return idle({ replies: [{ version: 2, type: "manimScenesListed", requestId: message.requestId, error: desktopOnly }] });
    case "renderManim":
      return idle({ replies: [{ version: 2, type: "manimRenderResult", requestId: message.requestId, ok: false, elementId: message.elementId, error: desktopOnly }] });
    case "renderAllManim":
      return idle({ replies: [{ version: 2, type: "manimRenderAllResult", requestId: message.requestId, ok: false, rendered: 0, skipped: 0, error: desktopOnly }] });
    case "presence":
      return idle();
    case "command":
      return runCommand(session, message);
    case "saveExport":
      return idle({ effects: [{ type: "download", filename: exportFilename(session.text, message.format), href: message.data }] });
    case "log":
      return idle({ effects: [{ type: "log", level: message.level, message: message.message }] });
    default: {
      const unreachable: never = message;
      return idle({ effects: [{ type: "log", level: "error", message: `Unsupported SlidePix message ${JSON.stringify(unreachable)}` }] });
    }
  }
}

export async function storeMedia(
  session: WebSession,
  requestId: string,
  name: string,
  mime: string,
  decoded: { bytes?: Uint8Array; error?: string }
): Promise<WebHostResult> {
  if (decoded.error || !decoded.bytes) return idle({ replies: [assetReply(requestId, undefined, decoded.error ?? "Could not import asset")] });
  if (decoded.bytes.byteLength === 0) return idle({ replies: [assetReply(requestId, undefined, "Choose a non-empty media file.")] });
  if (decoded.bytes.byteLength > MAX_MEDIA_BYTES) return idle({ replies: [assetReply(requestId, undefined, "Media files are limited to 100 MB per import.")] });
  const reference = await embeddedReference(decoded.bytes, name, mime);
  const type = mime || "application/octet-stream";
  session.assets.set(reference, { mime: type, bytes: decoded.bytes });
  return idle({
    changed: true,
    writtenAssets: [reference],
    replies: [
      { version: 2, type: "assetImported", requestId, reference, storage: "embedded" },
      { version: 2, type: "assetsUpdated", references: [reference] }
    ]
  });
}

function decodeMedia(base64: string): { bytes?: Uint8Array; error?: string } {
  try {
    return { bytes: decodeBase64(base64) };
  } catch {
    return { error: "Could not import asset" };
  }
}

async function publish(session: WebSession, assetBase: string, changed: boolean, clearAssets = false): Promise<WebHostResult> {
  session.fresh = false;
  return idle({ changed, clearAssets, replies: [await deckMessage(session, assetBase)] });
}

async function replaceDocument(session: WebSession, requestId: string, baseRevision: string, text: string): Promise<WebHostResult> {
  const currentRevision = await revisionForText(session.text);
  if (baseRevision !== currentRevision) {
    return idle({ replies: [await editMessage(session, requestId, false, "stale", "The deck changed before this edit could be applied.")] });
  }
  const incoming = parseDeckText(text);
  if (!incoming.ok) return idle({ replies: [await editMessage(session, requestId, false, "invalid", incoming.message)] });
  const previous = session.text;
  session.text = text;
  session.history = recordDocumentEdit(session.history, previous, text);
  return idle({ changed: previous !== text, replies: [await editMessage(session, requestId, true)] });
}

async function applyHistory(session: WebSession, command: "undo" | "redo", requestId: string): Promise<WebHostResult> {
  const step = command === "undo" ? undoDocument(session.history, session.text) : redoDocument(session.history, session.text);
  if (!step) return idle({ replies: [await historyMessage(session, requestId, command, false, command === "undo" ? "Nothing to undo." : "Nothing to redo.")] });
  if ("error" in step) return idle({ replies: [await historyMessage(session, requestId, command, false, step.error)] });
  session.history = step.history;
  session.text = step.text;
  return idle({ changed: true, replies: [await historyMessage(session, requestId, command, true)] });
}

async function runCommand(session: WebSession, message: Extract<WebviewToHostMessage, { type: "command" }>): Promise<WebHostResult> {
  switch (message.command) {
    case "undo":
    case "redo":
      return applyHistory(session, message.command, message.requestId ?? crypto.randomUUID());
    case "save":
      return idle({ replies: [notice(message.requestId ?? crypto.randomUUID(), "success", "Saved in this browser.")] });
    case "exportPdf":
    case "exportPng":
      return idle({ replies: [{ version: 2, type: "startCapture", format: message.command === "exportPdf" ? "pdf" : "png" }] });
    case "present":
      return present(session);
    case "exportProject":
      return exportBrowserProject(session, message.requestId);
    case "exportPptx":
    case "exportWeb":
    case "presenter":
    case "configureMcp":
    case "resolveGitConflict":
    case "openTextEditor":
    case "startLive":
    case "copyLiveInvite":
    case "stopLive":
    case "saveLiveCopy":
      return idle({ replies: [notice(message.requestId ?? crypto.randomUUID(), "error", desktopOnly)] });
    default: {
      const unreachable: never = message.command;
      return idle({ effects: [{ type: "log", level: "error", message: `Unsupported command ${String(unreachable)}` }] });
    }
  }
}

function exportBrowserProject(session: WebSession, requestId: string | undefined): WebHostResult {
  const id = requestId ?? crypto.randomUUID();
  const parsed = parseDeckText(session.text);
  if (!parsed.ok) return idle({ replies: [notice(id, "error", parsed.message)] });
  const plan = projectAssetPlan(parsed.deck);
  if (plan.error) return idle({ replies: [notice(id, "error", plan.error)] });
  const files = new Map<string, Uint8Array>();
  for (const reference of plan.references) {
    const asset = session.assets.get(reference);
    if (!asset) return idle({ replies: [notice(id, "error", `Missing asset ${reference}.`)] });
    files.set(`deck.assets/${reference}`, asset.bytes);
  }
  files.set("deck.slidepix.json", new TextEncoder().encode(serializeDeck(parsed.deck)));
  const zip = storedZip(files);
  return idle({
    effects: [{ type: "download", filename: "deck.zip", href: `data:application/zip;base64,${bytesToBase64(zip)}` }],
    replies: [notice(id, "success", `Exported project with ${files.size} files.`)]
  });
}

function projectAssetPlan(deck: Deck): { error?: string; references: string[] } {
  const references: string[] = [];
  const linked = "Embed linked media before exporting the project from the browser.";
  for (const slide of deck.slides) {
    if (slide.backgroundImage) {
      if (slide.backgroundImage.storage !== "embedded") return { error: linked, references };
      references.push(slide.backgroundImage.src);
    }
    for (const element of slide.elements) {
      if (element.type === "manim" && element.script) return { error: "Export Project in the browser does not include Manim scripts. Use the VS Code editor for that deck.", references };
      if (element.type === "manim" && element.outputMedia) references.push(element.outputMedia.src);
      if (element.type !== "image" && element.type !== "video") continue;
      if (element.storage !== "embedded") return { error: linked, references };
      references.push(element.src);
      if (element.type === "video" && element.poster) references.push(element.poster);
    }
  }
  return { references };
}

function present(session: WebSession): WebHostResult {
  const parsed = parseDeckText(session.text);
  if (!parsed.ok) return idle({ replies: [notice(crypto.randomUUID(), "error", parsed.message)] });
  const html = renderDeckDocument(parsed.deck, (reference, storage) => {
    if (storage !== "embedded") return "";
    const asset = session.assets.get(reference);
    return asset ? `data:${asset.mime};base64,${bytesToBase64(asset.bytes)}` : "";
  }, { mode: "present" });
  return idle({ effects: [{ type: "present", html }] });
}

async function deckMessage(session: WebSession, assetBase: string): Promise<HostToWebviewMessage> {
  const base = assetBase.endsWith("/") ? assetBase : `${assetBase}/`;
  const revision = await revisionForText(session.text);
  const parsed = parseDeckText(session.text);
  const flags = historyFlags(session.history);
  if (!parsed.ok) {
    return { version: 2, type: "invalidDeck", text: session.text, revision, message: parsed.message, gitConflict: false, uri: base, linkedUri: base, surface: "web" };
  }
  return { version: 2, type: "deck", text: session.text, deck: parsed.deck, revision, uri: base, linkedUri: base, surface: "web", ...flags };
}

async function editMessage(
  session: WebSession,
  requestId: string,
  accepted: boolean,
  reason?: "stale" | "invalid" | "applyFailed",
  message?: string
): Promise<HostToWebviewMessage> {
  const parsed = parseDeckText(session.text);
  return {
    version: 2,
    type: "documentEditResult",
    requestId,
    accepted,
    revision: await revisionForText(session.text),
    text: session.text,
    deck: parsed.ok ? parsed.deck : undefined,
    reason,
    message: parsed.ok ? message : message ?? parsed.message,
    ...historyFlags(session.history)
  };
}

async function historyMessage(
  session: WebSession,
  requestId: string,
  command: "undo" | "redo",
  ok: boolean,
  error?: string
): Promise<HostToWebviewMessage> {
  const parsed = parseDeckText(session.text);
  return {
    version: 2,
    type: "historyResult",
    requestId,
    command,
    ok: ok && parsed.ok,
    revision: await revisionForText(session.text),
    text: session.text,
    deck: parsed.ok ? parsed.deck : undefined,
    error: error ?? (parsed.ok ? undefined : parsed.message),
    ...historyFlags(session.history)
  };
}

function assetReply(requestId: string, reference: string | undefined, error?: string): HostToWebviewMessage {
  return reference
    ? { version: 2, type: "assetImported", requestId, reference, storage: "embedded" }
    : { version: 2, type: "assetImported", requestId, error };
}

function notice(notificationId: string, status: "success" | "error", message: string): HostToWebviewMessage {
  return { version: 2, type: "notify", notificationId, status, message };
}

function exportFilename(text: string, format: "pdf" | "png"): string {
  const parsed = parseDeckText(text);
  const title = parsed.ok ? parsed.deck.metadata.title : "slidepix";
  const safe = title.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "slidepix";
  return `${safe}.${format}`;
}

function historySteps(history: DocumentHistory | undefined): DocumentHistory {
  if (!history || !Array.isArray(history.past) || !Array.isArray(history.future)) return emptyDocumentHistory();
  const step = (value: unknown): value is HistoryStep => {
    if (!value || typeof value !== "object") return false;
    const record = value as HistoryStep;
    return typeof record.before === "string" && typeof record.after === "string";
  };
  if (!history.past.every(step) || !history.future.every(step)) return emptyDocumentHistory();
  return { past: history.past, future: history.future };
}

function idle(partial: Partial<WebHostResult> = {}): WebHostResult {
  return { changed: false, clearAssets: false, writtenAssets: [], replies: [], effects: [], ...partial };
}
