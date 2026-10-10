import { sha256Hex } from "./revision.js";

export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;

const mimeExtensions: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/bmp": ".bmp",
  "image/avif": ".avif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "video/ogg": ".ogv"
};

export function safeExtension(name: string, mime: string): string {
  const dot = name.lastIndexOf(".");
  const fromName = dot >= 0 ? name.slice(dot).toLowerCase() : "";
  if (/^\.[a-z0-9]{1,8}$/.test(fromName)) return fromName;
  return mimeExtensions[mime] ?? ".bin";
}

export async function embeddedReference(bytes: Uint8Array, name: string, mime: string): Promise<string> {
  return `${await sha256Hex(bytes)}${safeExtension(name, mime)}`;
}

export function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export function matchesMediaKind(name: string, mime: string, kind: "image" | "video"): boolean {
  if (kind === "image") return mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(name);
  return mime.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogv)$/i.test(name);
}
