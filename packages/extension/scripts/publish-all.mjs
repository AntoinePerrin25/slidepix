import { spawn } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { packageTargets } from "./stage-native.mjs";
import { packageTargetVsixes } from "./package-targets.mjs";

const extension = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

function run(args, label) {
  return new Promise((resolve, reject) => {
    console.log(`${label}: pnpm exec ${args.join(" ")}`);
    const child = spawn("pnpm", ["exec", ...args], { cwd: extension, stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("close", (status) => {
      if (status === 0) resolve();
      else reject(new Error(`${label} failed (${status ?? "signal"}).`));
    });
  });
}

let files;
try {
  files = await packageTargetVsixes(targets);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const jobs = files.flatMap((file) => {
  const vsix = path.basename(file);
  const publishes = [];
  if (!ovsxOnly) publishes.push(run(["vsce", "publish", "--packagePath", vsix, "--skip-duplicate"], `${vsix} marketplace`));
  publishes.push(run(["ovsx", "publish", vsix, "--skip-duplicate"], `${vsix} open-vsx`));
  return publishes;
});

const results = await Promise.allSettled(jobs);
const failures = results.filter((result) => result.status === "rejected");
if (failures.length > 0) {
  for (const failure of failures) console.error(failure.reason instanceof Error ? failure.reason.message : failure.reason);
  process.exit(1);
}
