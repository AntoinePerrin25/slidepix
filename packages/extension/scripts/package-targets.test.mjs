import { createRequire } from "node:module";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, expect, it } from "vitest";
import { retargetVsix } from "./package-targets.mjs";

const require = createRequire(import.meta.url);
const vsceRequire = createRequire(require.resolve("@vscode/vsce/package.json"));
const yauzl = vsceRequire("yauzl");
const yazl = vsceRequire("yazl");
const directories = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function writeZip(file, entries) {
  return new Promise((resolve, reject) => {
    const zip = new yazl.ZipFile();
    for (const [name, contents] of Object.entries(entries)) {
      zip.addBuffer(Buffer.from(contents), name);
    }
    zip.outputStream.pipe(createWriteStream(file)).on("close", resolve).on("error", reject);
    zip.on("error", reject);
    zip.end();
  });
}

function readZip(file) {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true }, (error, zip) => {
      if (error) {
        reject(error);
        return;
      }
      const entries = new Map();
      const fail = (failure) => {
        zip.close();
        reject(failure);
      };
      zip.on("entry", (entry) => {
        if (entry.fileName.endsWith("/")) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (openError, stream) => {
          if (openError) {
            fail(openError);
            return;
          }
          const chunks = [];
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("end", () => {
            entries.set(entry.fileName, Buffer.concat(chunks));
            zip.readEntry();
          });
          stream.on("error", fail);
        });
      });
      zip.on("end", () => resolve(entries));
      zip.on("error", fail);
      zip.readEntry();
    });
  });
}

it("swaps the iroh binary and the manifest target", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "slidepix-vsix-"));
  directories.push(directory);
  const source = path.join(directory, "base.vsix");
  const destination = path.join(directory, "linux.vsix");
  await writeZip(source, {
    "extension.vsixmanifest": `<Identity TargetPlatform="darwin-arm64"/>`,
    "extension/package.json": `{"name":"slidepix-deck"}`,
    "extension/dist/native/iroh/index.js": "loader",
    "extension/dist/native/iroh/iroh.darwin-arm64.node": "darwin-binary"
  });

  await retargetVsix(source, destination, {
    fromTarget: "darwin-arm64",
    toTarget: "linux-x64",
    fromFile: "iroh.darwin-arm64.node",
    toFile: "iroh.linux-x64-gnu.node",
    binary: Buffer.from("linux-binary")
  });

  const entries = await readZip(destination);
  expect(entries.get("extension.vsixmanifest")?.toString("utf8")).toBe(`<Identity TargetPlatform="linux-x64"/>`);
  expect(entries.get("extension/package.json")?.toString("utf8")).toBe(`{"name":"slidepix-deck"}`);
  expect(entries.get("extension/dist/native/iroh/index.js")?.toString("utf8")).toBe("loader");
  expect(entries.has("extension/dist/native/iroh/iroh.darwin-arm64.node")).toBe(false);
  expect(entries.get("extension/dist/native/iroh/iroh.linux-x64-gnu.node")?.toString("utf8")).toBe("linux-binary");
});

it("rejects a manifest that does not name the source target once", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "slidepix-vsix-"));
  directories.push(directory);
  const source = path.join(directory, "base.vsix");
  await writeZip(source, {
    "extension.vsixmanifest": `<Identity Id="slidepix-deck"/>`,
    "extension/dist/native/iroh/iroh.darwin-arm64.node": "darwin-binary"
  });

  await expect(retargetVsix(source, path.join(directory, "linux.vsix"), {
    fromTarget: "darwin-arm64",
    toTarget: "linux-x64",
    fromFile: "iroh.darwin-arm64.node",
    toFile: "iroh.linux-x64-gnu.node",
    binary: Buffer.from("linux-binary")
  })).rejects.toThrow('Expected one TargetPlatform="darwin-arm64"');
});
