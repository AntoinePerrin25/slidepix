import { describe, expect, it } from "vitest";
import * as path from "node:path";
import {
  buildManimArgv,
  buildManimRenderArgs,
  discoverManimScenes,
  findUvWorkspaceRoot,
  findVenvManimNear,
  formatManimLogChunk,
  assignManimBasenames,
  manimDeckStem,
  manimOutputBasename,
  pythonLaunchForManim,
  manimProcessEnv,
  manimRenderConcurrency,
  mapWithConcurrency,
  splitManimOutput,
  manimSpawnFailure,
  parseManimProgress,
  resolveManimLaunch,
  scriptContentFingerprint,
  uvInstallCommand
} from "./manim-render.js";

describe("manim render helpers", () => {
  it("detects Scene subclasses", () => {
    const source = `
from manim import *

class Intro(Scene):
    pass

class Outro(MovingCameraScene):
    pass
`;
    expect(discoverManimScenes(source)).toEqual(["Intro", "Outro"]);
  });

  it("builds render args for still and transparent video output", () => {
    expect(buildManimRenderArgs({
      scriptPath: "/tmp/scene.py",
      scene: "Intro",
      output: "image",
      orientation: "horizontal",
      quality: "high",
      transparent: false,
      mediaDir: "/tmp/media",
      outputName: "slidepix-1"
    })).toEqual([
      "render", "-qh", "-r", "1920,1080", "--media_dir", "/tmp/media", "-o", "slidepix-1", "--format=png", "-s",
      "--progress_bar=leave", "/tmp/scene.py", "Intro"
    ]);

    expect(buildManimRenderArgs({
      scriptPath: "/tmp/scene.py",
      scene: "Intro",
      output: "video",
      orientation: "vertical",
      quality: "medium",
      transparent: true,
      mediaDir: "/tmp/media",
      outputName: "slidepix-2"
    })).toEqual(expect.arrayContaining(["-r", "720,1280", "--format=webm", "--transparent"]));

    expect(buildManimRenderArgs({
      scriptPath: "/tmp/scene.py",
      scene: "Intro",
      output: "image",
      orientation: "vertical",
      quality: "low",
      transparent: true,
      mediaDir: "/tmp/media",
      outputName: "slidepix-3"
    })).toEqual(expect.arrayContaining(["-r", "480,854", "--transparent"]));
  });

  it("assembles argv for direct, venv, and uv launches", () => {
    const options = {
      scriptPath: "/repo/examples/demo.manim.py",
      scene: "Intro",
      output: "image" as const,
      orientation: "horizontal" as const,
      quality: "low" as const,
      transparent: false,
      mediaDir: "/tmp/media",
      outputName: "slidepix-1"
    };

    expect(buildManimArgv({ command: "manim", args: [] }, options)).toMatchObject({
      command: "manim",
      args: ["render", "-ql", "-r", "854,480", "--media_dir", "/tmp/media", "-o", "slidepix-1", "--format=png", "-s", "--progress_bar=leave", "/repo/examples/demo.manim.py", "Intro"]
    });

    expect(buildManimArgv({ command: "/repo/.venv/bin/manim", args: [] }, options).command).toBe("/repo/.venv/bin/manim");
    expect(buildManimArgv({ command: "uv", args: ["run", "manim"], cwd: "/repo" }, options)).toEqual({
      command: "uv",
      cwd: "/repo",
      args: ["run", "manim", "render", "-ql", "-r", "854,480", "--media_dir", "/tmp/media", "-o", "slidepix-1", "--format=png", "-s", "--progress_bar=leave", "/repo/examples/demo.manim.py", "Intro"]
    });
  });

  it("resolves launchers near the deck", () => {
    const exists = (target: string) => target.endsWith("/repo/.venv/bin/manim") || target === "/repo/.venv";
    expect(findVenvManimNear("/repo/examples", exists)).toBe("/repo/.venv/bin/manim");
    expect(findUvWorkspaceRoot("/repo/examples/nested", exists)).toBe("/repo");
    expect(resolveManimLaunch("/repo/examples/demo.slidepix.json", "", exists)).toEqual({
      command: "/repo/.venv/bin/manim",
      args: []
    });
    expect(resolveManimLaunch("/repo/examples/demo.slidepix.json", "uv run manim")).toEqual({
      command: "uv",
      args: ["run", "manim"]
    });
    const programFiles = "C:\\Program Files\\Manim\\manim.exe";
    expect(resolveManimLaunch("/repo/examples/demo.slidepix.json", programFiles, (target) => target === programFiles)).toEqual({
      command: programFiles,
      args: []
    });
    const venvOnly = (target: string) => target === "/repo/.venv";
    expect(resolveManimLaunch("/repo/examples/demo.slidepix.json", "", venvOnly)).toEqual({ command: "manim", args: [] });
    const windows = (target: string) => target === path.join("/repo", ".venv", "Scripts", "manim.exe");
    expect(findVenvManimNear("/repo/examples", windows)).toBe(path.join("/repo", ".venv", "Scripts", "manim.exe"));
  });

  it("names output after the deck and scene, shared across slides", () => {
    expect(manimDeckStem("/talks/fourier.slidepix.json")).toBe("fourier");
    expect(manimOutputBasename("fourier", "HarmonicsStill")).toBe("fourier-HarmonicsStill");
    expect(manimOutputBasename("fourier", undefined)).toBe("fourier");
    expect(manimOutputBasename("fourier", "HarmonicsStill", ["fourier-HarmonicsStill"])).toBe("fourier-HarmonicsStill-2");
    expect(assignManimBasenames([
      { id: "a", deckName: "fourier", scene: "HarmonicsStill", ownStem: "fourier-Harmoniques-HarmonicsStill" },
      { id: "b", deckName: "fourier", scene: "RectPulse" }
    ], ["fourier-Harmoniques-HarmonicsStill"])).toEqual(new Map([
      ["a", "fourier-HarmonicsStill"],
      ["b", "fourier-RectPulse"]
    ]));
    const shared = assignManimBasenames([
      { id: "copy", deckName: "morph", scene: "HarmonicsStill", shareKey: "same", ownStem: "morph-Harmoniques-HarmonicsStill" },
      { id: "owner", deckName: "morph", scene: "HarmonicsStill", shareKey: "same", ownStem: "morph-L-idee-HarmonicsStill" }
    ], ["morph-L-idee-HarmonicsStill", "morph-Harmoniques-HarmonicsStill"]);
    expect(shared.get("owner")).toBe("morph-HarmonicsStill");
    expect(shared.get("copy")).toBe("morph-HarmonicsStill");
    const distinct = assignManimBasenames([
      { id: "low", deckName: "fourier", scene: "HarmonicsStill", shareKey: "low" },
      { id: "high", deckName: "fourier", scene: "HarmonicsStill", shareKey: "high" }
    ], []);
    expect(distinct.get("low")).toBe("fourier-HarmonicsStill");
    expect(distinct.get("high")).toBe("fourier-HarmonicsStill-2");
  });

  it("finds Python beside the Manim launch", () => {
    expect(pythonLaunchForManim({ command: "/repo/.venv/bin/manim", args: [] })).toEqual({
      command: "/repo/.venv/bin/python",
      args: []
    });
    expect(pythonLaunchForManim({ command: "uv", args: ["run", "manim"] })).toEqual({
      command: "uv",
      args: ["run", "python"]
    });
    expect(pythonLaunchForManim({ command: "python", args: ["-m", "manim"] })).toEqual({
      command: "python",
      args: []
    });
  });

  it("drops progress ticks from the log and keeps one math thread per process", () => {
    expect(splitManimOutput("Animation 0: 45%|###\r")).toEqual({ log: "", percent: 45 });
    expect(splitManimOutput("Traceback (most recent call last):\nError: boom\n").log).toContain("Traceback");
    expect(manimProcessEnv({ PATH: "/usr/bin" })).toMatchObject({ PATH: "/usr/bin", OMP_NUM_THREADS: "1", VECLIB_MAXIMUM_THREADS: "1" });
    expect(manimRenderConcurrency(5, 8)).toBe(5);
    expect(manimRenderConcurrency(20, 8)).toBe(8);
  });

  it("runs at most the requested number of workers at once", async () => {
    let active = 0;
    let maxActive = 0;
    await mapWithConcurrency([0, 1, 2, 3], 2, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
    });
    expect(maxActive).toBe(2);
  });

  it("reads manim progress and strips carriage returns", () => {
    expect(parseManimProgress("Animation 0: 45%|###")).toBe(45);
    expect(formatManimLogChunk("partial\rdone\n")).toBe("partial\ndone\n");
    expect(uvInstallCommand("win32").command).toBe("powershell.exe");
    expect(uvInstallCommand("darwin").args.join(" ")).toContain("astral.sh/uv/install.sh");
    expect(manimSpawnFailure("error: Failed to spawn `manim`\nCaused by: No such file or directory (os error 2)")).toBe(true);
  });

  it("fingerprints script content deterministically", () => {
    expect(scriptContentFingerprint("alpha")).toBe(scriptContentFingerprint("alpha"));
    expect(scriptContentFingerprint("alpha")).not.toBe(scriptContentFingerprint("beta"));
  });
});
