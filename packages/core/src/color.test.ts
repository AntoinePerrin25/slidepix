import { describe, expect, it } from "vitest";
import { morphColorRuntime, toOklchCss } from "./color.js";

describe("oklch morph colors", () => {
  it("converts sRGB red to the OKLCH red hue", () => {
    const color = toOklchCss("#ff0000");
    const match = color.match(/^oklch\(([0-9.]+) ([0-9.]+) ([0-9.]+) \/ ([0-9.]+)\)$/);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBeCloseTo(0.628, 2);
    expect(Number(match?.[2])).toBeCloseTo(0.258, 2);
    expect(Number(match?.[3])).toBeCloseTo(29.23, 0);
    expect(match?.[4]).toBe("1");
  });

  it("keeps an authored oklch color in oklch", () => {
    expect(toOklchCss("oklch(0.7 0.12 200 / 0.5)")).toBe("oklch(0.7 0.12 200 / 0.5)");
    expect(toOklchCss("transparent")).toBe("oklch(0 0 0 / 0)");
    expect(toOklchCss("rgb(0, 0, 255)")).toContain("oklch(");
  });

  it("uses the same converter in the presentation runtime", () => {
    const runtime = new Function(`${morphColorRuntime()}; return toOklch;`)() as (value: string) => string;
    expect(runtime("#3366cc")).toBe(toOklchCss("#3366cc"));
    expect(morphColorRuntime()).toContain("function animatePaint");
    expect(morphColorRuntime()).toContain("borderColor");
  });
});
