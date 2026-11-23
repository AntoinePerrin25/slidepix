/** SVG paths, connectors, and sanitized inline SVG. */

const PATH_COMMANDS = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]+$/;
const UNSAFE_SVG = /<\s*\/?\s*(script|foreignObject|iframe|object|embed|image|use|link|style|animate|set)\b|\son[a-z]+\s*=|javascript\s*:|data\s*:\s*text\/html|<\s*!--/i;

export type Point = { x: number; y: number };
export type VectorAnchorName = "center" | "top" | "right" | "bottom" | "left";
export type VectorAnchor = { x: number; y: number; elementId?: string; anchor: VectorAnchorName };
export type VectorRouting = "straight" | "elbow" | "curve";

export type VectorModel = {
  id: string;
  kind: "path" | "connector" | "svg";
  x: number;
  y: number;
  width: number;
  height: number;
  d: string;
  svg: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  markerStart: "none" | "arrow";
  markerEnd: "none" | "arrow";
  routing: VectorRouting;
  from?: VectorAnchor;
  to?: VectorAnchor;
};

type Box = { id: string; x: number; y: number; width: number; height: number };

export function isSafePath(value: string): boolean {
  return value.length <= 20_000 && PATH_COMMANDS.test(value);
}

/** Inline SVG is painted only when it is a single `<svg>` document without scripts, handlers, or external references. */
export function isSafeSvg(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 100_000 && /^<svg[\s>]/i.test(trimmed) && /<\/svg>\s*$/i.test(trimmed) && !UNSAFE_SVG.test(trimmed);
}

export function anchorPoint(box: { x: number; y: number; width: number; height: number }, anchor: VectorAnchorName): Point {
  if (anchor === "top") return { x: box.x + box.width / 2, y: box.y };
  if (anchor === "bottom") return { x: box.x + box.width / 2, y: box.y + box.height };
  if (anchor === "left") return { x: box.x, y: box.y + box.height / 2 };
  if (anchor === "right") return { x: box.x + box.width, y: box.y + box.height / 2 };
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function resolveAnchor(anchor: VectorAnchor, boxes: readonly Box[], selfId: string): Point {
  const target = anchor.elementId ? boxes.find((item) => item.id === anchor.elementId && item.id !== selfId) : undefined;
  if (!target) return { x: anchor.x, y: anchor.y };
  return anchorPoint(target, anchor.anchor);
}

function route(start: Point, end: Point, routing: VectorRouting): Point[] {
  if (routing === "elbow") {
    const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
    return horizontal ? [start, { x: end.x, y: start.y }, end] : [start, { x: start.x, y: end.y }, end];
  }
  return [start, end];
}

function pathData(points: Point[], start: Point, end: Point, routing: VectorRouting, originX: number, originY: number): string {
  const local = (point: Point) => `${trim(point.x - originX)} ${trim(point.y - originY)}`;
  if (routing === "curve") {
    const dx = (end.x - start.x) / 2;
    const dy = (end.y - start.y) / 2;
    return `M ${local(start)} C ${local({ x: start.x + dx, y: start.y })} ${local({ x: end.x - dx, y: end.y - dy })} ${local(end)}`;
  }
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${local(point)}`).join(" ");
}

function trim(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Rewrites connector boxes from their anchors. Path and SVG elements keep the box the author set. */
export function syncVectors(vectors: VectorModel[], boxes: readonly Box[]): void {
  for (const element of vectors) {
    if (element.kind !== "connector" || !element.from || !element.to) continue;
    const start = resolveAnchor(element.from, boxes, element.id);
    const end = resolveAnchor(element.to, boxes, element.id);
    element.from.x = start.x;
    element.from.y = start.y;
    element.to.x = end.x;
    element.to.y = end.y;
    const points = route(start, end, element.routing);
    const pad = Math.max(12, element.strokeWidth * 4);
    const minX = Math.min(...points.map((point) => point.x)) - pad;
    const minY = Math.min(...points.map((point) => point.y)) - pad;
    const maxX = Math.max(...points.map((point) => point.x)) + pad;
    const maxY = Math.max(...points.map((point) => point.y)) + pad;
    element.x = minX;
    element.y = minY;
    element.width = Math.max(1, maxX - minX);
    element.height = Math.max(1, maxY - minY);
    element.d = pathData(points, start, end, element.routing, minX, minY);
  }
}

export function vectorMarkup(element: VectorModel): string {
  if (element.kind === "svg") {
    return isSafeSvg(element.svg) ? element.svg.trim() : "";
  }
  const viewBox = element.kind === "path" ? "0 0 100 100" : `0 0 ${trim(element.width)} ${trim(element.height)}`;
  const markerId = `mk-${element.id.replace(/[^A-Za-z0-9_-]/g, "")}`;
  const d = element.d && isSafePath(element.d) ? element.d : "M 8 50 L 92 50";
  const markers = `${marker(markerId, "s", element.stroke, element.markerStart === "arrow")}${marker(markerId, "e", element.stroke, element.markerEnd === "arrow")}`;
  const start = element.markerStart === "arrow" ? ` marker-start="url(#${markerId}-s)"` : "";
  const end = element.markerEnd === "arrow" ? ` marker-end="url(#${markerId}-e)"` : "";
  return `<svg class="slidepix-vector-svg" xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="none">${markers}<path d="${escapeAttr(d)}" fill="${escapeAttr(element.fill)}" stroke="${escapeAttr(element.stroke)}" stroke-width="${trim(element.strokeWidth)}" stroke-linecap="round" stroke-linejoin="round"${start}${end}/></svg>`;
}

function marker(id: string, end: "s" | "e", color: string, enabled: boolean): string {
  if (!enabled) return "";
  const refX = end === "e" ? 8 : 0;
  return `<defs><marker id="${id}-${end}" viewBox="0 0 8 8" markerWidth="8" markerHeight="8" refX="${refX}" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="${escapeAttr(color)}"/></marker></defs>`;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
