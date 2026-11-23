import { describe, expect, it } from "vitest";
import { descendants, groupElements, parentCycle, reidentifyElements, ungroupElements } from "./groups.js";
import { createDeck, elementSchema, groupElementSchema, parseDeckText, type SlideElement } from "./schema.js";

function box(id: string, x: number, parentId?: string): SlideElement {
  return elementSchema.parse({ id, morphKey: id, type: "shape", shape: "rectangle", x, y: 10, width: 40, height: 20, rotation: 0, opacity: 1, z: 1, locked: false, hidden: false, parentId });
}

describe("groups", () => {
  it("nests a group and keeps the link when copied", () => {
    const elements = [box("a", 0), box("b", 80)];
    const group = groupElementSchema.parse({ id: "g", morphKey: "g", type: "group", x: 0, y: 0, width: 10, height: 10, rotation: 0, opacity: 1, z: 0, locked: false, hidden: false });
    expect(groupElements(elements, ["a", "b"], group)).toBe(true);
    expect(elements.find((item) => item.id === "a")?.parentId).toBe("g");
    expect(descendants(elements, "g")).toHaveLength(2);
    const copy = reidentifyElements(elements, true);
    const copiedGroup = copy.find((item) => item.type === "group")!;
    expect(copy.filter((item) => item.parentId === copiedGroup.id)).toHaveLength(2);
    expect(ungroupElements(elements, "g")).toBe(true);
    expect(elements.some((item) => item.parentId)).toBe(false);
  });

  it("rejects a parent cycle and an unknown component", () => {
    expect(parentCycle([{ id: "outer", parentId: "inner" }, { id: "inner", parentId: "outer" }], "outer")).toBe(true);
    const deck = createDeck();
    const text = JSON.stringify(deck);
    const broken = text.replace(`"elements":[`, `"elements":[{"id":"instance","morphKey":"instance","type":"component","componentId":"missing","x":0,"y":0,"width":10,"height":10},`);
    const parsed = parseDeckText(broken);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).toContain("Unknown component");
  });
});
