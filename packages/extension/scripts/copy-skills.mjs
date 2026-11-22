import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extension = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(extension, "..", "..", ".agents", "skills");
const names = ["slidepix-pres", "slidepix-mcp-review"];

for (const name of names) {
  const destination = path.join(extension, "skills", name);
  await rm(destination, { recursive: true, force: true });
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(source, name), destination, { recursive: true });
}
