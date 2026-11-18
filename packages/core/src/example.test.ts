import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveMediaPath } from "./assets.js";
import { renderDeckDocument } from "./render.js";
import { parseDeckText } from "./schema.js";

const examplePath = fileURLToPath(new URL("../../../examples/slidepix-demo.slidepix.json", import.meta.url));

describe("visual regression example", () => {
  it("stays valid, self-contained, and covers the primary authoring features", async () => {
    const parsed = parseDeckText(await readFile(examplePath, "utf8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.message);

    const { deck } = parsed;
    const elements = deck.slides.flatMap((slide) => slide.elements);
    const text = elements.filter((element) => element.type === "text");
    const images = elements.filter((element) => element.type === "image");
    const videos = elements.filter((element) => element.type === "video");
    const shapes = elements.filter((element) => element.type === "shape");
    const tables = elements.filter((element) => element.type === "table");
    const effects = new Set(deck.slides.flatMap((slide) => slide.timeline.map((step) => step.effect)));

    expect(deck.slides).toHaveLength(7);
    expect(text.some((element) => element.markdown.includes("$$"))).toBe(true);
    expect(text.some((element) => element.markdown.includes("```typescript"))).toBe(true);
    expect(deck.theme).toMatchObject({ background: "#ffffff", foreground: "#111827" });
    expect(JSON.stringify(deck).toLowerCase()).not.toContain("research");
    expect(images.some((element) => element.border.width > 0 && element.borderRadius > 0)).toBe(true);
    expect(images.some((element) => element.edgeFade > 0 && element.crop.width < 1)).toBe(true);
    expect(videos).toHaveLength(1);
    expect(tables.some((element) => element.rows >= 4 && element.cells.some((row) => row.some((cell) => cell.includes("$x^2$"))))).toBe(true);
    expect(tables.some((element) => element.style.cellFill === "transparent")).toBe(true);
    expect(new Set(shapes.map((element) => element.shape))).toEqual(new Set(["rectangle", "ellipse", "triangle"]));
    expect(shapes.some((element) => element.shadow.enabled)).toBe(true);
    expect(effects).toEqual(new Set(["appear", "fade", "fly"]));
    expect(new Set(deck.slides.map((slide) => slide.transition.type))).toEqual(
      new Set(["none", "fade", "slide-down", "slide-right", "slide-up", "morph", "slide-left"])
    );

    const morphDestination = deck.slides.find((slide) => slide.transition.type === "morph");
    const morphSource = morphDestination && deck.slides[deck.slides.indexOf(morphDestination) - 1];
    expect(morphDestination).toBeDefined();
    expect(morphSource).toBeDefined();
    const sourceNames = new Set(morphSource?.elements.map((element) => element.name).filter(Boolean));
    expect(morphDestination?.elements.filter((element) => element.name && sourceNames.has(element.name)).length).toBeGreaterThanOrEqual(3);

    for (const media of [...images, ...videos]) {
      expect(media.storage).toBe("embedded");
      await expect(access(resolveMediaPath(examplePath, media.src, media.storage))).resolves.toBeUndefined();
      if (media.type === "video" && media.poster) {
        await expect(access(resolveMediaPath(examplePath, media.poster, media.storage))).resolves.toBeUndefined();
      }
    }
  });
});

describe("bibliography example", () => {
  const deckPath = fileURLToPath(new URL("../../../examples/bibliography/citations.slidepix.json", import.meta.url));
  const bibPath = fileURLToPath(new URL("../../../examples/bibliography/references.bib", import.meta.url));

  it("links the reference file and renders every citation", async () => {
    const parsed = parseDeckText(await readFile(deckPath, "utf8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.message);
    const source = await readFile(bibPath, "utf8");
    expect(parsed.deck.bibliography).toMatchObject({ file: "references.bib", storage: "linked", source, indent: 4 });
    expect(resolveMediaPath(deckPath, parsed.deck.bibliography.file, parsed.deck.bibliography.storage, [fileURLToPath(new URL("../../../examples/bibliography/", import.meta.url))])).toBe(bibPath);
    expect(parsed.deck.slides.filter((slide) => slide.bibliography)).toHaveLength(1);
    const html = renderDeckDocument(parsed.deck, undefined, { bibliographySource: source });
    expect(html).toContain('<sup class="slidepix-citation-sup">1</sup>');
    expect(html).toContain("(Smith and Johnson 2024)");
    expect(html).toContain("(Turing 1950)");
    expect(html).toContain("(Vaswani, Shazeer, Parmar, and Uszkoreit 2017)");
    expect(html).toContain("[@absente]");
    expect(html).toContain("Bibliographie");
    expect(html).toContain("Quantum Computing Advances in Machine Learning");
    expect(html).toContain("https://arxiv.org/abs/1706.03762");
  });
});
