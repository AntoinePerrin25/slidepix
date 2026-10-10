import type { DocumentHistory } from "../../extension/src/document-history";
import type { StoredAsset, WebSession } from "./session.js";

const DB_NAME = "slidepix-web";
const DB_VERSION = 1;

type DeckRecord = { text: string; history: DocumentHistory };

export type LoadedWebDeck = { text: string; history?: DocumentHistory; assets: Map<string, StoredAsset> };

export async function loadWebDeck(): Promise<LoadedWebDeck | undefined> {
  const db = await openDb();
  const record = await request<DeckRecord | undefined>(db.transaction("deck", "readonly").objectStore("deck").get("current"));
  if (!record || typeof record.text !== "string") return undefined;
  const assets = new Map<string, StoredAsset>();
  const keys = await request<string[]>(db.transaction("assets", "readonly").objectStore("assets").getAllKeys() as IDBRequest<string[]>);
  for (const key of keys) {
    const row = await request<StoredAsset | undefined>(db.transaction("assets", "readonly").objectStore("assets").get(key));
    if (!row?.bytes) continue;
    const bytes = row.bytes instanceof Uint8Array ? row.bytes : new Uint8Array(row.bytes);
    assets.set(key, { mime: row.mime || "application/octet-stream", bytes });
  }
  return { text: record.text, history: record.history, assets };
}

export async function saveWebDeck(session: WebSession): Promise<void> {
  const db = await openDb();
  await request(db.transaction("deck", "readwrite").objectStore("deck").put({ text: session.text, history: session.history } satisfies DeckRecord, "current"));
}

export async function saveWebAsset(reference: string, asset: StoredAsset): Promise<void> {
  const db = await openDb();
  await request(db.transaction("assets", "readwrite").objectStore("assets").put(asset, reference));
}

export async function clearWebAssets(): Promise<void> {
  const db = await openDb();
  await request(db.transaction("assets", "readwrite").objectStore("assets").clear());
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("deck")) db.createObjectStore("deck");
      if (!db.objectStoreNames.contains("assets")) db.createObjectStore("assets");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function request<T>(operation: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error);
  });
}
