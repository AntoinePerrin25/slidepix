/** SVG paths, connectors, and sanitized inline SVG. */

const PATH_COMMANDS = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]+$/;
const UNSAFE_SVG = /<\s*\/?\s*(script|foreignObject|iframe|object|embed|image|use|link|style|animate|set)\b|\son[a-z]+\s*=|javascript\s*:|data\s*:\s*text\/html|<\s*!--/i;
const PATH_TOKEN = /[A-Za-z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g;

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
  bend?: Point;
  from?: VectorAnchor;
  to?: VectorAnchor;
};

type Box = { id: string; x: number; y: number; width: number; height: number };
type Segment =
  | { op: "M" | "L"; p: Point }
  | { op: "C"; c1: Point; c2: Point; p: Point }
  | { op: "Q"; c: Point; p: Point };

export type PathHandle = {
  segment: number;
  field: "p" | "c1" | "c2" | "c";
  x: number;
  y: number;
  kind: "anchor" | "control";
  linkSegment?: number;
};

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

const ANCHORS: readonly VectorAnchorName[] = ["center", "top", "right", "bottom", "left"];

/** Closest side or center of another element, in slide units, within `maxDistance`. */
export function nearestAnchor(point: Point, boxes: readonly Box[], selfId: string, maxDistance: number): VectorAnchor | undefined {
  let best: { distance: number; anchor: VectorAnchor } | undefined;
  for (const box of boxes) {
    if (box.id === selfId) continue;
    for (const name of ANCHORS) {
      const at = anchorPoint(box, name);
      const distance = Math.hypot(at.x - point.x, at.y - point.y);
      if (distance <= maxDistance && (!best || distance < best.distance)) {
        best = { distance, anchor: { x: at.x, y: at.y, elementId: box.id, anchor: name } };
      }
    }
  }
  return best?.anchor;
}

/** Where the bend handle sits. A straight connector offers its midpoint so a drag can bow it. */
export function connectorBendPoint(start: Point, end: Point, routing: VectorRouting, bend?: Point): Point {
  if (bend && routing !== "straight") return bend;
  if (routing === "elbow") {
    const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
    return horizontal ? { x: end.x, y: start.y } : { x: start.x, y: end.y };
  }
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
}

export function pathHandles(d: string): PathHandle[] {
  const segments = parsePath(d);
  if (!segments) return [];
  const handles: PathHandle[] = [];
  let anchor = -1;
  segments.forEach((segment, index) => {
    if (segment.op === "M" || segment.op === "L") {
      handles.push({ segment: index, field: "p", x: segment.p.x, y: segment.p.y, kind: "anchor" });
      anchor = index;
      return;
    }
    if (segment.op === "Q") {
      handles.push({ segment: index, field: "c", x: segment.c.x, y: segment.c.y, kind: "control", linkSegment: anchor });
      handles.push({ segment: index, field: "p", x: segment.p.x, y: segment.p.y, kind: "anchor" });
      anchor = index;
      return;
    }
    if (segment.op !== "C") return;
    handles.push({ segment: index, field: "c1", x: segment.c1.x, y: segment.c1.y, kind: "control", linkSegment: anchor });
    handles.push({ segment: index, field: "c2", x: segment.c2.x, y: segment.c2.y, kind: "control", linkSegment: index });
    handles.push({ segment: index, field: "p", x: segment.p.x, y: segment.p.y, kind: "anchor" });
    anchor = index;
  });
  return handles;
}

export function movePathHandle(d: string, segment: number, field: PathHandle["field"], x: number, y: number): string {
  const segments = parsePath(d);
  const target = segments?.[segment];
  if (!segments || !target) return d;
  const point = { x, y };
  if (field === "p") target.p = point;
  else if (target.op === "C" && (field === "c1" || field === "c2")) target[field] = point;
  else if (target.op === "Q" && field === "c") target.c = point;
  else return d;
  return serializePath(segments);
}

function resolveAnchor(anchor: VectorAnchor, boxes: readonly Box[], selfId: string): Point {
  const target = anchor.elementId ? boxes.find((item) => item.id === anchor.elementId && item.id !== selfId) : undefined;
  if (!target) return { x: anchor.x, y: anchor.y };
  return anchorPoint(target, anchor.anchor);
}

function route(start: Point, end: Point, routing: VectorRouting, bend?: Point): Point[] {
  if (routing === "elbow") return [start, connectorBendPoint(start, end, routing, bend), end];
  if (routing === "curve" && bend) return [start, bend, end];
  return [start, end];
}

function pathData(points: Point[], start: Point, end: Point, routing: VectorRouting, originX: number, originY: number, bend?: Point): string {
  const local = (point: Point) => `${trim(point.x - originX)} ${trim(point.y - originY)}`;
  if (routing === "curve") {
    const pull = bend ?? connectorBendPoint(start, end, "straight");
    if (bend) return `M ${local(start)} Q ${local(pull)} ${local(end)}`;
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
    const points = route(start, end, element.routing, element.bend);
    const pad = Math.max(24, element.strokeWidth * 6);
    const minX = Math.min(...points.map((point) => point.x)) - pad;
    const minY = Math.min(...points.map((point) => point.y)) - pad;
    const maxX = Math.max(...points.map((point) => point.x)) + pad;
    const maxY = Math.max(...points.map((point) => point.y)) + pad;
    element.x = minX;
    element.y = minY;
    element.width = Math.max(1, maxX - minX);
    element.height = Math.max(1, maxY - minY);
    element.d = pathData(points, start, end, element.routing, minX, minY, element.bend);
  }
}

export function vectorMarkup(element: VectorModel): string {
  if (element.kind === "svg") {
    return isSafeSvg(element.svg) ? element.svg.trim() : "";
  }
  const viewBox = element.kind === "path" ? "0 0 100 100" : `0 0 ${trim(element.width)} ${trim(element.height)}`;
  const d = element.d && isSafePath(element.d) ? element.d : "M 8 50 L 92 50";
  const arrow = arrowheadMarkup(d, element.strokeWidth, element.markerStart === "arrow", element.markerEnd === "arrow", element.stroke);
  const cap = element.markerStart === "arrow" || element.markerEnd === "arrow" ? "butt" : "round";
  return `<svg class="slidepix-vector-svg" xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" preserveAspectRatio="none"><path class="slidepix-vector-stroke" d="${escapeAttr(arrow.d)}" fill="${escapeAttr(element.fill)}" stroke="${escapeAttr(element.stroke)}" stroke-width="${trim(element.strokeWidth)}" stroke-linecap="${cap}" stroke-linejoin="round"/>${arrow.heads}</svg>`;
}

function arrowheadMarkup(d: string, strokeWidth: number, start: boolean, end: boolean, color: string): { d: string; heads: string } {
  const segments = parsePath(d);
  if (!segments || (!start && !end)) return { d, heads: "" };
  const length = Math.max(10, strokeWidth * 3.4);
  const heads: string[] = [];
  if (end) {
    const last = segments[segments.length - 1];
    const toward = incomingPoint(segments);
    if (last && toward) heads.push(placeHead(last, toward, length, color));
  }
  if (start) {
    const first = segments[0];
    const next = segments[1];
    const toward = outgoingPoint(segments);
    if (first?.op === "M" && next && toward) {
      const tip = { ...first.p };
      const retired = retreat(tip, toward, length);
      const tucked = retreat(tip, toward, Math.max(0, retired.used - Math.min(0.75, retired.used / 2)));
      const delta = { x: tucked.point.x - tip.x, y: tucked.point.y - tip.y };
      first.p = tucked.point;
      if (next.op === "C") next.c1 = { x: next.c1.x + delta.x, y: next.c1.y + delta.y };
      else if (next.op === "Q") next.c = { x: next.c.x + delta.x, y: next.c.y + delta.y };
      heads.push(`<path class="slidepix-vector-head" d="${triangle(tip, retired.point)}" fill="${escapeAttr(color)}" stroke="none"/>`);
    }
  }
  return { d: serializePath(segments), heads: heads.join("") };
}

function placeHead(segment: Segment, toward: Point, length: number, color: string): string {
  const tip = { ...segment.p };
  const retired = retreat(tip, toward, length);
  const tucked = retreat(tip, toward, Math.max(0, retired.used - Math.min(0.75, retired.used / 2)));
  const delta = { x: tucked.point.x - tip.x, y: tucked.point.y - tip.y };
  segment.p = tucked.point;
  if (segment.op === "C") segment.c2 = { x: segment.c2.x + delta.x, y: segment.c2.y + delta.y };
  else if (segment.op === "Q") segment.c = { x: segment.c.x + delta.x, y: segment.c.y + delta.y };
  return `<path class="slidepix-vector-head" d="${triangle(tip, retired.point)}" fill="${escapeAttr(color)}" stroke="none"/>`;
}

function retreat(tip: Point, toward: Point, distance: number): { point: Point; used: number } {
  const dx = toward.x - tip.x;
  const dy = toward.y - tip.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return { point: { ...tip }, used: 0 };
  const used = Math.min(distance, len * 0.45);
  return { point: { x: tip.x + (dx / len) * used, y: tip.y + (dy / len) * used }, used };
}

function triangle(tip: Point, base: Point): string {
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const dist = Math.hypot(dx, dy) || 1;
  const half = dist * 0.42;
  const px = -dy / dist;
  const py = dx / dist;
  return `M ${trim(tip.x)} ${trim(tip.y)} L ${trim(base.x + px * half)} ${trim(base.y + py * half)} L ${trim(base.x - px * half)} ${trim(base.y - py * half)} Z`;
}

function incomingPoint(segments: readonly Segment[]): Point | undefined {
  const last = segments[segments.length - 1];
  if (!last || last.op === "M") return undefined;
  if (last.op === "C") return last.c2;
  if (last.op === "Q") return last.c;
  const previous = segments[segments.length - 2];
  return previous?.p;
}

function outgoingPoint(segments: readonly Segment[]): Point | undefined {
  const next = segments[1];
  if (!next) return undefined;
  if (next.op === "C") return next.c1;
  if (next.op === "Q") return next.c;
  return next.p;
}

function parsePath(d: string): Segment[] | undefined {
  const tokens = d.match(PATH_TOKEN);
  if (!tokens) return undefined;
  const commands: { op: string; nums: number[] }[] = [];
  let op = "";
  let nums: number[] = [];
  const flush = () => { if (op) commands.push({ op, nums }); };
  for (const token of tokens) {
    if (/[A-Za-z]/.test(token)) {
      flush();
      op = token;
      nums = [];
    } else nums.push(Number(token));
  }
  flush();
  const segments: Segment[] = [];
  for (const command of commands) {
    const head = command.op.toUpperCase();
    if (command.op !== head) return undefined;
    if ((head === "M" || head === "L") && command.nums.length === 2) segments.push({ op: head, p: { x: command.nums[0]!, y: command.nums[1]! } });
    else if (head === "C" && command.nums.length === 6) segments.push({ op: "C", c1: { x: command.nums[0]!, y: command.nums[1]! }, c2: { x: command.nums[2]!, y: command.nums[3]! }, p: { x: command.nums[4]!, y: command.nums[5]! } });
    else if (head === "Q" && command.nums.length === 4) segments.push({ op: "Q", c: { x: command.nums[0]!, y: command.nums[1]! }, p: { x: command.nums[2]!, y: command.nums[3]! } });
    else if (head === "Z") continue;
    else return undefined;
  }
  return segments.length ? segments : undefined;
}

function serializePath(segments: readonly Segment[]): string {
  return segments.map((segment) => {
    if (segment.op === "C") return `C ${trim(segment.c1.x)} ${trim(segment.c1.y)} ${trim(segment.c2.x)} ${trim(segment.c2.y)} ${trim(segment.p.x)} ${trim(segment.p.y)}`;
    if (segment.op === "Q") return `Q ${trim(segment.c.x)} ${trim(segment.c.y)} ${trim(segment.p.x)} ${trim(segment.p.y)}`;
    return `${segment.op} ${trim(segment.p.x)} ${trim(segment.p.y)}`;
  }).join(" ");
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
