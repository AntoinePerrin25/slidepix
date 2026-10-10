import "./theme.css";
import { startBrowserHost } from "./browser-host.js";
import { controlMedia } from "./register-sw.js";

const boot = document.querySelector("#boot");

try {
  await controlMedia();
  await startBrowserHost();
  await import("../../webview/src/main");
  boot?.remove();
} catch (error) {
  if (boot) boot.textContent = error instanceof Error ? error.message : "SlidePix could not start.";
}
