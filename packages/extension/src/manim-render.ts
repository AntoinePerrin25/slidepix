import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { ManimElement, ManimOrientation, ManimQuality } from "@slidepix/core";
import {
  MANIM_QUALITY_FLAG,
  manimRenderFingerprint,
  manimRenderResolution,
  manimSettingsFingerprint
} from "@slidepix/core/manim";

export type ManimLaunch = {
  command: string;
  args: string[];
  cwd?: string;
};

export type ManimRenderOptions = {
  scriptPath: string;
  scene: string;
  output: ManimElement["output"];
  orientation: ManimOrientation;
  quality: ManimQuality;
  transparent: boolean;
  mediaDir: string;
  outputName: string;
};

const VENV_MANIM_RELATIVE = [
  [".venv", "bin", "manim"],
  [".venv", "Scripts", "manim.exe"],
  [".venv", "Scripts", "manim"]
] as const;

export function venvManimCandidates(directory: string): string[] {
  return VENV_MANIM_RELATIVE.map((parts) => path.join(directory, ...parts));
}

export function findVenvManimNear(startDirectory: string, exists: (target: string) => boolean = existsSync): string | undefined {
  let directory = path.resolve(startDirectory);
  const { root } = path.parse(directory);
  while (true) {
    const candidate = venvManimCandidates(directory).find((target) => exists(target));
    if (candidate) return candidate;
    if (directory === root) break;
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return undefined;
}

export function findUvWorkspaceRoot(startDirectory: string, exists: (target: string) => boolean = existsSync): string | undefined {
  let directory = path.resolve(startDirectory);
  const { root } = path.parse(directory);
  while (true) {
    if (exists(path.join(directory, ".venv"))) return directory;
    if (directory === root) break;
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return undefined;
}

export function resolveManimLaunch(
  deckPath: string,
  configuredExecutable = "",
  exists: (target: string) => boolean = existsSync
): ManimLaunch {
  const configured = configuredExecutable.trim();
  if (configured) {
    if (exists(configured)) return { command: configured, args: [] };
    if (configured.includes(" ")) {
      const tokens = configured.split(/\s+/).filter(Boolean);
      return { command: tokens[0]!, args: tokens.slice(1) };
    }
    return { command: configured, args: [] };
  }
  const deckDirectory = path.dirname(path.resolve(deckPath));
  const venvManim = findVenvManimNear(deckDirectory, exists);
  if (venvManim) return { command: venvManim, args: [] };
  return { command: "manim", args: [] };
}

export function manimSpawnFailure(text: string): boolean {
  return /Failed to spawn [`']?manim|ENOENT|No such file or directory/i.test(text);
}

export function assembleManimInvocation(launch: ManimLaunch, renderArgs: string[]): ManimLaunch {
  return { command: launch.command, args: [...launch.args, ...renderArgs], cwd: launch.cwd };
}

const SCENE_PATTERN = /^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*Scene[^)]*\)\s*:/gm;
const MEDIA_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".mp4", ".webm", ".gif", ".mov", ".avif", ".jxl"]);

export function discoverManimScenes(source: string): string[] {
  const names = new Set<string>();
  for (const match of source.matchAll(SCENE_PATTERN)) {
    if (match[1]) names.add(match[1]);
  }
  return [...names].sort((left, right) => left.localeCompare(right));
}

export function scriptContentFingerprint(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

export function renderFingerprintForElement(element: ManimElement, scriptSource: string): string {
  return manimRenderFingerprint(manimSettingsFingerprint(element), scriptContentFingerprint(scriptSource));
}

export function buildManimRenderArgs(options: ManimRenderOptions): string[] {
  const quality = MANIM_QUALITY_FLAG[options.quality];
  const format = options.output === "image"
    ? "png"
    : options.transparent
      ? "webm"
      : "mp4";
  const { width, height } = manimRenderResolution(options.orientation, options.quality);
  const argv = [
    "render",
    quality,
    "-r",
    `${width},${height}`,
    "--media_dir",
    options.mediaDir,
    "-o",
    options.outputName,
    `--format=${format}`
  ];
  if (options.transparent) argv.push("--transparent");
  if (options.output === "image") argv.push("-s");
  argv.push("--progress_bar=leave", options.scriptPath, options.scene);
  return argv;
}

export function sanitizeManimFileStem(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

/** Deck file stem without `.slidepix.json`, used in persistent Manim media names. */
export function manimDeckStem(deckPath: string): string {
  return path.basename(deckPath).replace(/\.slidepix\.json$/i, "");
}

/** One stem per shared render. The same scene and settings share a file across slides; a different render that sanitizes to the same stem gets a numeric suffix. */
export function assignManimBasenames(
  entries: { id: string; deckName: string; scene?: string; ownStem?: string; shareKey?: string }[],
  usedStems: readonly string[]
): Map<string, string> {
  const reserved = new Set(usedStems);
  for (const entry of entries) {
    if (entry.ownStem && entry.ownStem === manimOutputBasename(entry.deckName, entry.scene)) reserved.delete(entry.ownStem);
  }
  const names = new Map<string, string>();
  const shared = new Map<string, string>();
  for (const entry of entries) {
    const key = entry.shareKey ?? `${entry.deckName}\0${entry.scene ?? ""}`;
    const existing = shared.get(key);
    if (existing) {
      names.set(entry.id, existing);
      continue;
    }
    const name = manimOutputBasename(entry.deckName, entry.scene, [...reserved]);
    shared.set(key, name);
    names.set(entry.id, name);
    reserved.add(name);
  }
  return names;
}

/** Stable `deck-scene` stem. The slide title is not part of the name, so the same scene can be reused on another slide. */
export function manimOutputBasename(deckName: string, scene: string | undefined, taken: readonly string[] = []): string {
  const parts = [deckName, scene ?? ""].map((part) => sanitizeManimFileStem(part)).filter(Boolean);
  const preferred = parts.join("-").slice(0, 100) || "manim";
  if (!taken.includes(preferred)) return preferred;
  const room = preferred.slice(0, 96);
  let index = 2;
  while (taken.includes(`${room}-${index}`)) index += 1;
  return `${room}-${index}`;
}

/** Python from the Manim launch, used to convert a still after Manim writes PNG. */
export function pythonLaunchForManim(launch: ManimLaunch): ManimLaunch {
  const base = path.basename(launch.command).toLowerCase();
  if (base === "manim" || base === "manim.exe") {
    const pythonName = base.endsWith(".exe") ? "python.exe" : "python";
    return { command: path.join(path.dirname(launch.command), pythonName), args: [], cwd: launch.cwd };
  }
  if (base === "uv" || base === "uv.exe") {
    const args = [...launch.args];
    let index = -1;
    for (let cursor = 0; cursor < args.length; cursor += 1) {
      if (args[cursor]?.toLowerCase() === "manim") index = cursor;
    }
    if (index >= 0) args[index] = "python";
    else args.push("python");
    return { command: launch.command, args, cwd: launch.cwd };
  }
  if (base.startsWith("python")) {
    const args: string[] = [];
    for (let index = 0; index < launch.args.length; index += 1) {
      const arg = launch.args[index] ?? "";
      if (arg === "-m" && launch.args[index + 1] === "manim") {
        index += 1;
        continue;
      }
      if (arg === "manim") continue;
      args.push(arg);
    }
    return { command: launch.command, args, cwd: launch.cwd };
  }
  return { command: process.platform === "win32" ? "python" : "python3", args: [], cwd: launch.cwd };
}

export function formatManimLogChunk(chunk: string): string {
  return chunk.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function parseManimProgress(text: string): number | undefined {
  const matches = [...text.matchAll(/(\d{1,3})%/g)];
  const last = matches.at(-1)?.[1];
  if (!last) return undefined;
  const value = Number(last);
  return value >= 0 && value <= 100 ? value : undefined;
}

/** Keep diagnostic lines. Progress ticks stay out of the log so a full pipe cannot stall the other renders. */
export function splitManimOutput(chunk: string): { log: string; percent?: number } {
  const text = formatManimLogChunk(chunk);
  const percent = parseManimProgress(text);
  const log = text.split("\n").filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (/\d{1,3}%/.test(trimmed) && !/\b(error|traceback|warning|exception)\b/i.test(trimmed)) return false;
    return true;
  }).join("\n");
  return { log, percent };
}

/** One math thread per process, so each scene can occupy a different core. */
export function manimProcessEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return {
    ...base,
    PYTHONUNBUFFERED: "1",
    TERM: "dumb",
    FORCE_COLOR: "0",
    OMP_NUM_THREADS: "1",
    OPENBLAS_NUM_THREADS: "1",
    MKL_NUM_THREADS: "1",
    VECLIB_MAXIMUM_THREADS: "1",
    NUMEXPR_NUM_THREADS: "1"
  };
}

export function manimRenderConcurrency(sceneCount: number, cores = os.availableParallelism()): number {
  const scenes = Math.max(0, Math.floor(sceneCount));
  const width = Math.max(1, Math.floor(cores));
  return Math.max(1, Math.min(scenes || 1, width));
}

export async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const run = async (): Promise<void> => {
    while (next < items.length) {
      const current = next;
      next += 1;
      const item = items[current];
      if (item === undefined) return;
      results[current] = await worker(item, current);
    }
  };
  const workers = Math.max(1, Math.min(items.length, Math.floor(limit) || 1));
  await Promise.all(Array.from({ length: workers }, () => run()));
  return results;
}

export function uvInstallCommand(platform: NodeJS.Platform): { command: string; args: string[] } {
  if (platform === "win32") {
    return {
      command: "powershell.exe",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "irm https://astral.sh/uv/install.ps1 | iex"]
    };
  }
  return { command: "sh", args: ["-c", "curl -LsSf https://astral.sh/uv/install.sh | sh"] };
}

export function buildManimArgv(launch: ManimLaunch, options: ManimRenderOptions): ManimLaunch {
  return assembleManimInvocation(launch, buildManimRenderArgs(options));
}

export async function findRenderedMedia(mediaDir: string, outputName: string): Promise<string | undefined> {
  const targetBase = outputName.replace(/\.[^.]+$/, "");
  const candidates: { filePath: string; mtimeMs: number }[] = [];

  async function walk(directory: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(filePath);
        continue;
      }
      const extension = path.extname(entry.name).toLowerCase();
      if (!MEDIA_EXTENSIONS.has(extension)) continue;
      const base = path.basename(entry.name, extension);
      if (base !== outputName && base !== targetBase && !entry.name.includes(outputName)) continue;
      const fileStat = await stat(filePath);
      candidates.push({ filePath, mtimeMs: fileStat.mtimeMs });
    }
  }

  await walk(mediaDir);
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return candidates[0]?.filePath;
}
