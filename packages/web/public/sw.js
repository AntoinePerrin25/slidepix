/* SlidePix media cache. The database name, version, and /slidepix/media/ path
   must stay aligned with packages/web/src/paths.ts and packages/web/src/storage.ts. */
const DB_NAME = "slidepix-web";
const DB_VERSION = 1;
const MEDIA_PREFIX = "/slidepix/media/";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || !url.pathname.startsWith(MEDIA_PREFIX)) return;
  const name = decodeURIComponent(url.pathname.slice(MEDIA_PREFIX.length));
  if (!name || name.includes("/") || name.includes("\\") || name.includes("\0")) {
    event.respondWith(new Response("Not found", { status: 404 }));
    return;
  }
  event.respondWith(readAsset(name));
});

function openDb() {
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

async function readAsset(name) {
  const db = await openDb();
  const row = await new Promise((resolve, reject) => {
    const request = db.transaction("assets", "readonly").objectStore("assets").get(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  if (!row || !row.bytes) return new Response("Not found", { status: 404 });
  return new Response(row.bytes, {
    headers: {
      "Content-Type": row.mime || "application/octet-stream",
      "Cache-Control": "no-store"
    }
  });
}
