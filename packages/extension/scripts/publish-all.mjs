import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { packageTargets } from "./stage-native.mjs";

const extension = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requested = process.argv.slice(2).filter((arg) => arg !== "--");
const targets = requested.length > 0 ? requested : packageTargets;

for (const target of targets) {
  if (!packageTargets.includes(target)) {
    console.error(`Live collaboration is not available on ${target}. Supported targets: ${packageTargets.join(", ")}.`);
    process.exit(1);
  }
  const staged = spawnSync(process.execPath, ["scripts/stage-native.mjs", `--target=${target}`], { cwd: extension, stdio: "inherit" });
  if (staged.status !== 0) process.exit(staged.status ?? 1);
  const published = spawnSync("pnpm", ["exec", "vsce", "publish", "--no-dependencies", "--target", target], { cwd: extension, stdio: "inherit" });
  if (published.status !== 0) process.exit(published.status ?? 1);
}
