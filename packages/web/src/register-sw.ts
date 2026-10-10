import { WEB_BASE } from "./paths.js";

export async function controlMedia(): Promise<void> {
  if (!("serviceWorker" in navigator)) throw new Error("This browser cannot keep SlidePix media on the page.");
  const controlling = new Promise<void>((resolve, reject) => {
    if (navigator.serviceWorker.controller) {
      resolve();
      return;
    }
    const timer = window.setTimeout(() => reject(new Error("SlidePix could not start its media cache.")), 4000);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.clearTimeout(timer);
      resolve();
    }, { once: true });
  });
  await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: WEB_BASE, updateViaCache: "none" });
  await controlling;
}
