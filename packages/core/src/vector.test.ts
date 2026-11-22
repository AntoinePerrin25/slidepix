import { describe, expect, it } from "vitest";
import { isSafePath, isSafeSvg, syncVectors, vectorMarkup, type VectorModel } from "./vector.js";

function connector(partial: Partial<VectorModel> = {}): VectorModel {
  return {
    id: "arrow",
    kind: "connector",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    d: "",
    svg: "",
    fill: "transparent",
    stroke: "#111",
    strokeWidth: 4,
    markerStart: "none",
    markerEnd: "arrow",
    routing: "straight",
    from: { x: 0, y: 0, anchor: "center" },
    to: { x: 100, y: 40, anchor: "center" },
    ...partial
  };
}

describe("vectors", () => {
  it("follows an element anchor and draws an arrow", () => {
    const arrow = connector({ from: { x: 0, y: 0, elementId: "card", anchor: "right" }, to: { x: 10, y: 10, anchor: "center" } });
    syncVectors([arrow], [arrow, { id: "card", x: 20, y: 30, width: 80, height: 40 }]);
    expect(arrow.from?.x).toBe(100);
    expect(arrow.from?.y).toBe(50);
    expect(vectorMarkup(arrow)).toContain("marker-end");
    expect(vectorMarkup(arrow)).toContain("M ");
  });

  it("rejects scripts and accepts a plain path", () => {
    expect(isSafePath("M 0 0 L 10 10")).toBe(true);
    expect(isSafePath("M 0 0 <script>")).toBe(false);
    expect(isSafeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>`)).toBe(true);
    expect(isSafeSvg(`<svg><script>alert(1)</script></svg>`)).toBe(false);
  });
});
