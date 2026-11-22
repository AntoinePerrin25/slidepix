import type { SlideElement } from "./schema.js";

export type Box = { x: number; y: number; width: number; height: number };

export function descendants(elements: readonly SlideElement[], id: string): SlideElement[] {
  const children = elements.filter((element) => element.parentId === id);
  return children.flatMap((child) => [child, ...descendants(elements, child.id)]);
}

export function parentCycle(elements: readonly { id: string; parentId?: string }[], id: string): boolean {
  const seen = new Set<string>();
  let current = elements.find((element) => element.id === id);
  while (current?.parentId) {
    if (seen.has(current.id)) return true;
    seen.add(current.id);
    current = elements.find((element) => element.id === current?.parentId);
  }
  return false;
}

export function topLevelIds(elements: readonly SlideElement[], ids: readonly string[]): string[] {
  const selected = new Set(ids);
  return ids.filter((id) => {
    let parent = elements.find((element) => element.id === id)?.parentId;
    while (parent) {
      if (selected.has(parent)) return false;
      parent = elements.find((element) => element.id === parent)?.parentId;
    }
    return true;
  });
}

export function unionBox(boxes: readonly Box[]): Box {
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width));
  const maxY = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

export function collectMembers(elements: readonly SlideElement[], ids: readonly string[]): SlideElement[] {
  const seen = new Set<string>();
  const chosen: SlideElement[] = [];
  for (const id of topLevelIds(elements, ids)) {
    const element = elements.find((item) => item.id === id);
    if (!element) continue;
    for (const item of [element, ...descendants(elements, element.id)]) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      chosen.push(structuredClone(item));
    }
  }
  return chosen;
}

/** New ids for a copied family. Links that point outside the copy are dropped. */
export function reidentifyElements(elements: SlideElement[], preserveMorph = true): SlideElement[] {
  const ids = new Map(elements.map((element) => [element.id, crypto.randomUUID()]));
  return elements.map((element) => {
    const copy = structuredClone(element);
    copy.id = ids.get(element.id)!;
    if (!preserveMorph) copy.morphKey = crypto.randomUUID();
    if (copy.parentId) {
      const parent = ids.get(copy.parentId);
      if (parent) copy.parentId = parent;
      else delete copy.parentId;
    }
    if (copy.type === "vector") {
      if (copy.from?.elementId) {
        const next = ids.get(copy.from.elementId);
        if (next) copy.from.elementId = next;
        else delete copy.from.elementId;
      }
      if (copy.to?.elementId) {
        const next = ids.get(copy.to.elementId);
        if (next) copy.to.elementId = next;
        else delete copy.to.elementId;
      }
    }
    if (copy.type === "chart" && copy.dataLink) {
      const next = ids.get(copy.dataLink.elementId);
      if (next) copy.dataLink = { elementId: next };
      else delete copy.dataLink;
    }
    return copy;
  });
}

export function withoutElements(elements: SlideElement[], ids: readonly string[]): SlideElement[] {
  const removed = new Set<string>();
  for (const id of ids) {
    removed.add(id);
    for (const child of descendants(elements, id)) removed.add(child.id);
  }
  return elements.filter((element) => !removed.has(element.id)).map((element) => clearLinks(element, removed));
}

export function removedElementIds(elements: readonly SlideElement[], ids: readonly string[]): Set<string> {
  const removed = new Set<string>();
  for (const id of ids) {
    removed.add(id);
    for (const child of descendants(elements, id)) removed.add(child.id);
  }
  return removed;
}

export function clearLinks<T extends SlideElement>(element: T, removed: ReadonlySet<string>): T {
  if (element.parentId && removed.has(element.parentId)) delete element.parentId;
  if (element.type === "vector") {
    if (element.from?.elementId && removed.has(element.from.elementId)) delete element.from.elementId;
    if (element.to?.elementId && removed.has(element.to.elementId)) delete element.to.elementId;
  }
  if (element.type === "chart" && element.dataLink && removed.has(element.dataLink.elementId)) delete element.dataLink;
  return element;
}

export function groupElements(elements: SlideElement[], ids: string[], group: Extract<SlideElement, { type: "group" }>): boolean {
  const tops = topLevelIds(elements, ids).map((id) => elements.find((element) => element.id === id)).filter((element): element is SlideElement => Boolean(element));
  if (tops.length < 2) return false;
  const members = tops.flatMap((element) => [element, ...descendants(elements, element.id)]);
  const box = unionBox(members);
  group.x = box.x;
  group.y = box.y;
  group.width = box.width;
  group.height = box.height;
  group.z = Math.min(...members.map((element) => element.z)) - 1;
  const sharedParent = tops.every((element) => element.parentId === tops[0]?.parentId) ? tops[0]?.parentId : undefined;
  if (sharedParent) group.parentId = sharedParent;
  else delete group.parentId;
  for (const element of tops) element.parentId = group.id;
  elements.push(group);
  return true;
}

export function ungroupElements(elements: SlideElement[], groupId: string): boolean {
  const group = elements.find((element) => element.id === groupId);
  if (!group || group.type !== "group") return false;
  for (const element of elements) {
    if (element.parentId !== groupId) continue;
    if (group.parentId) element.parentId = group.parentId;
    else delete element.parentId;
  }
  const index = elements.findIndex((element) => element.id === groupId);
  if (index >= 0) elements.splice(index, 1);
  return true;
}

export function scaleMembers(elements: SlideElement[], snapshots: readonly { id: string; x: number; y: number; width: number; height: number; from?: { x: number; y: number }; to?: { x: number; y: number } }[], origin: Box, next: Box): void {
  const sx = origin.width === 0 ? 1 : next.width / origin.width;
  const sy = origin.height === 0 ? 1 : next.height / origin.height;
  for (const snapshot of snapshots) {
    const element = elements.find((item) => item.id === snapshot.id);
    if (!element) continue;
    element.x = next.x + (snapshot.x - origin.x) * sx;
    element.y = next.y + (snapshot.y - origin.y) * sy;
    element.width = Math.max(1, snapshot.width * sx);
    element.height = Math.max(1, snapshot.height * sy);
    if (element.type === "vector" && element.kind === "connector") {
      if (element.from && snapshot.from && !element.from.elementId) {
        element.from.x = next.x + (snapshot.from.x - origin.x) * sx;
        element.from.y = next.y + (snapshot.from.y - origin.y) * sy;
      }
      if (element.to && snapshot.to && !element.to.elementId) {
        element.to.x = next.x + (snapshot.to.x - origin.x) * sx;
        element.to.y = next.y + (snapshot.to.y - origin.y) * sy;
      }
    }
  }
}
