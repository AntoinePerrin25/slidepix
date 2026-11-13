import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { packageTargets } from "./stage-native.mjs";

const extension = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(path.join(extension, "package.json"), "utf8"));
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const ovsxOnly = args.includes("--ovsx");
const requested = args.filter((arg) => arg !== "--ovsx");
const targets = requested.length > 0 ? requested : packageTargets;

for (const target of targets) {
  if (!packageTargets.includes(target)) {
    console.error(`Live collaboration is not available on ${target}. Supported targets: ${packageTargets.join(", ")}.`);
    process.exit(1);
  }
}
if (!process.env.OVSX_PAT) {
  console.error("Set OVSX_PAT to an Open VSX access token for the antoineperrin namespace.");
  process.exit(1);
}

function run(args) {
  const result = spawnSync("pnpm", ["exec", ...args], { cwd: extension, stdio: "inherit", env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

for (const target of targets) {
  const staged = spawnSync(process.execPath, ["scripts/stage-native.mjs", `--target=${target}`], { cwd: extension, stdio: "inherit" });
  if (staged.status !== 0) process.exit(staged.status ?? 1);
  const vsix = `${manifest.name}-${target}-${manifest.version}.vsix`;
  run(["vsce", "package", "--no-dependencies", "--target", target]);
  if (!ovsxOnly) run(["vsce", "publish", "--packagePath", vsix, "--skip-duplicate"]);
  run(["ovsx", "publish", vsix, "--skip-duplicate"]);
}
