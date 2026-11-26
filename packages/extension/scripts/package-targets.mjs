import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { createWriteStream } from "node:fs";
import { readFile, rename, rm } from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { currentTarget, nativeFile, packageTargets, resolveNativeBinary, stageNative } from "./stage-native.mjs";

const require = createRequire(import.meta.url);
const extension = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vsceRequire = createRequire(require.resolve("@vscode/vsce/package.json"));
const yauzl = vsceRequire("yauzl");
const yazl = vsceRequire("yazl");

export function nativeVsixPath(file) {
  return `extension/dist/native/iroh/${file}`;
}

export function replaceTargetPlatform(xml, fromTarget, toTarget) {
  const needle = `TargetPlatform="${fromTarget}"`;
  const hits = xml.split(needle).length - 1;
  if (hits !== 1) {
    throw new Error(`Expected one ${needle} in extension.vsixmanifest.`);
  }
  return xml.replace(needle, `TargetPlatform="${toTarget}"`);
}

function openZip(file) {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true }, (error, zip) => error ? reject(error) : resolve(zip));
  });
}

function nextEntry(zip) {
  return new Promise((resolve, reject) => {
    const finish = (error, entry) => {
      zip.off("entry", onEntry);
      zip.off("end", onEnd);
      zip.off("error", onError);
      if (error) reject(error);
      else resolve(entry);
    };
    const onEntry = (entry) => finish(undefined, entry);
    const onEnd = () => finish(undefined, null);
    const onError = (error) => finish(error, null);
    zip.once("entry", onEntry);
    zip.once("end", onEnd);
    zip.once("error", onError);
    zip.readEntry();
  });
}

function readEntry(zip, entry) {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
      stream.on("error", reject);
    });
  });
}

function entryOptions(entry) {
  const options = {
    compress: entry.compressionMethod !== 0,
    mtime: entry.getLastModDate()
  };
  const mode = (entry.externalFileAttributes >>> 16) & 0xffff;
  if (mode) options.mode = mode;
  return options;
}

export async function retargetVsix(source, destination, { fromTarget, toTarget, fromFile, toFile, binary }) {
  const partial = `${destination}.partial`;
  const zip = await openZip(source);
  const out = new yazl.ZipFile();
  const output = createWriteStream(partial);
  const finished = new Promise((resolve, reject) => {
    output.on("close", resolve);
    output.on("error", reject);
    out.outputStream.on("error", reject);
    out.on("error", reject);
  });
  finished.catch(() => {});
  out.outputStream.pipe(output);

  const removePath = nativeVsixPath(fromFile);
  const addPath = nativeVsixPath(toFile);
  let removed = false;
  try {
    for (;;) {
      const entry = await nextEntry(zip);
      if (!entry) break;
      if (entry.fileName === removePath) {
        removed = true;
        continue;
      }
      if (entry.fileName.endsWith("/")) {
        out.addEmptyDirectory(entry.fileName, { mtime: entry.getLastModDate() });
        continue;
      }
      const bytes = await readEntry(zip, entry);
      const contents = entry.fileName === "extension.vsixmanifest"
        ? Buffer.from(replaceTargetPlatform(bytes.toString("utf8"), fromTarget, toTarget), "utf8")
        : bytes;
      out.addBuffer(contents, entry.fileName, entryOptions(entry));
    }
    if (!removed) throw new Error(`VSIX is missing ${removePath}.`);
    out.addBuffer(binary, addPath, { compress: true });
    out.end();
    await finished;
    await rename(partial, destination);
  } catch (error) {
    output.destroy();
    await rm(partial, { force: true });
    throw error;
  } finally {
    zip.close();
  }
}

function vsixName(manifest, target) {
  return `${manifest.name}-${target}-${manifest.version}.vsix`;
}

function runVscePackage(target, allowMissingRepository) {
  const args = ["exec", "vsce", "package", "--no-dependencies", "--target", target];
  if (allowMissingRepository) args.push("--allow-missing-repository");
  const packed = spawnSync("pnpm", args, { cwd: extension, stdio: "inherit", env: process.env });
  if (packed.status !== 0) {
    throw new Error(`vsce package failed for ${target}.`);
  }
}

export async function packageTargetVsixes(targets, { allowMissingRepository = false } = {}) {
  if (targets.length === 0) return [];
  const manifest = JSON.parse(await readFile(path.join(extension, "package.json"), "utf8"));
  const binaries = new Map();
  for (const target of targets) {
    if (!packageTargets.includes(target)) {
      throw new Error(`Live collaboration is not available on ${target}. Supported targets: ${packageTargets.join(", ")}.`);
    }
    const binary = resolveNativeBinary(target);
    if (!binary) {
      throw new Error(`Missing native binary for ${target}. Install optional dependencies before packaging.`);
    }
    binaries.set(target, await readFile(binary));
  }

  const base = targets[0];
  try {
    if (stageNative(base, true) !== 0) {
      throw new Error(`Could not stage the ${base} iroh binary.`);
    }
    console.log(`Packaging ${base}; other targets reuse this VSIX with their iroh binary.`);
    runVscePackage(base, allowMissingRepository);
    const files = [path.join(extension, vsixName(manifest, base))];
    const fromFile = nativeFile(base);
    for (const target of targets.slice(1)) {
      const destination = path.join(extension, vsixName(manifest, target));
      console.log(`Writing ${target} by swapping ${nativeFile(target)} into the ${base} VSIX.`);
      await retargetVsix(files[0], destination, {
        fromTarget: base,
        toTarget: target,
        fromFile,
        toFile: nativeFile(target),
        binary: binaries.get(target)
      });
      files.push(destination);
    }
    return files;
  } finally {
    stageNative(currentTarget(), false);
  }
}
