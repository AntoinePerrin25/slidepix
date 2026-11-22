import vm from "node:vm";
import { codemodeCatalog } from "./catalog.js";

const MAX_CODE = 30_000;
const MAX_RESULT = 12_000;

/** Run model-written JavaScript. Host values cross the boundary only as JSON. */
export function runGuestCode(code: string, bindings: Record<string, (...args: unknown[]) => unknown> = {}): { result: unknown; logs: string[] } {
  if (code.length > MAX_CODE) throw new Error(`Code is longer than ${MAX_CODE} characters.`);
  const logs: string[] = [];
  const bridge = (kind: string, payload: string): string => {
    if (kind === "log") {
      if (logs.length < 30) logs.push(payload.slice(0, 2000));
      return "";
    }
    const fn = bindings[kind];
    if (!fn) return JSON.stringify({ ok: false, error: `Unknown operation: ${kind}` });
    try {
      const args = JSON.parse(payload) as unknown;
      if (!Array.isArray(args)) throw new Error("Arguments must be an array.");
      const value = fn(...args);
      return JSON.stringify({ ok: true, value: value === undefined ? null : value });
    } catch (error) {
      return JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  };
  const sandbox = {
    __bridge: bridge,
    __catalog: JSON.stringify(codemodeCatalog),
    __names: JSON.stringify(Object.keys(bindings))
  };
  vm.createContext(sandbox);
  let result: unknown;
  try {
    result = new vm.Script(prelude(code), { filename: "slidepix-code.js" }).runInContext(sandbox, { timeout: 1500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message.replace(/^slidepix-code\.js:/, "line "));
  }
  return { result: clip(result), logs };
}

function prelude(code: string): string {
  return `"use strict";
(() => {
const bridge = globalThis.__bridge;
const codemode = JSON.parse(globalThis.__catalog);
const names = JSON.parse(globalThis.__names);
delete globalThis.__bridge;
delete globalThis.__catalog;
delete globalThis.__names;
const slidepix = Object.create(null);
for (const name of names) {
  slidepix[name] = (...args) => {
    const reply = JSON.parse(bridge(name, JSON.stringify(args)));
    if (!reply.ok) throw new Error(reply.error);
    return reply.value;
  };
}
const console = { log(...args) { bridge("log", args.map((item) => typeof item === "string" ? item : JSON.stringify(item)).join(" ")); } };
return (new Function("slidepix", "codemode", "console", ${JSON.stringify(`"use strict";\n${code}`)}))(names.length ? slidepix : undefined, codemode, console);
})()`;
}

function clip(value: unknown): unknown {
  const text = JSON.stringify(value);
  if (!text || text.length <= MAX_RESULT) return value;
  return { truncated: true, preview: `${text.slice(0, MAX_RESULT)}…` };
}
