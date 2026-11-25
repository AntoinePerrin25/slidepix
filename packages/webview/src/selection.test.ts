import { describe, expect, it } from "vitest";
import { coveredBySelectedGroup, keepsCurrentSelection } from "./selection";

const elements = [
  { id: "group", type: "group" },
  { id: "title", type: "text", parentId: "group" },
  { id: "card", type: "shape" }
];

describe("selection gestures", () => {
  it("keeps a multi-selection when one of its members is pressed", () => {
    expect(keepsCurrentSelection(elements, ["title", "card"], "card", false)).toBe(true);
    expect(keepsCurrentSelection(elements, ["title", "card"], "card", true)).toBe(false);
  });

  it("keeps a selected group when one of its members is pressed", () => {
    expect(keepsCurrentSelection(elements, ["group"], "title", false)).toBe(true);
    expect(keepsCurrentSelection(elements, ["group"], "card", false)).toBe(false);
    expect([...coveredBySelectedGroup(elements, ["group"])]).toEqual(["title"]);
  });
});
