import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { executeDeck, searchCatalog } from "./code-mode";
import { loadDeck, selectSlides } from "./tools";

const selectorSchema = {
  deckPath: z.string().min(1).describe("Absolute path to a .slidepix.json deck"),
  slideIds: z.array(z.string()).optional().describe("Slide IDs to select"),
  indices: z.array(z.number().int().positive()).optional().describe("1-based slide indices to select")
};

function buildServer(): McpServer {
  const server = new McpServer(
    { name: "slidepix", version: "0.3.0" },
    { instructions: "Review with list_slides and inspect_slides; those tools never write. Author a deck with search, then execute. search reads the authoring catalog. execute runs JavaScript against one .slidepix.json file, validates it, and saves only that file when the deck changes. Do not generate a Python or Node script to write the JSON." }
  );

  server.registerTool("list_slides", {
    description: "List the slides and dimensions in a SlidePix deck without modifying it.",
    inputSchema: z.object({ deckPath: selectorSchema.deckPath })
  }, async ({ deckPath }) => {
    const deck = await loadDeck(deckPath);
    return { content: [{ type: "text", text: JSON.stringify({
      title: deck.metadata.title,
      dimensions: deck.size,
      slides: deck.slides.map((slide, index) => ({ id: slide.id, index: index + 1, title: slide.title, hidden: slide.hidden, hasNotes: Boolean(slide.notes.trim()) }))
    }, null, 2) }] };
  });

  server.registerTool("inspect_slides", {
    description: "Inspect structured slide and element metadata without modifying the deck.",
    inputSchema: z.object(selectorSchema)
  }, async ({ deckPath, slideIds, indices }) => {
    const deck = await loadDeck(deckPath);
    const slides = selectSlides(deck, slideIds, indices);
    return { content: [{ type: "text", text: JSON.stringify(slides.map((slide) => ({
      id: slide.id,
      index: deck.slides.findIndex((item) => item.id === slide.id) + 1,
      title: slide.title,
      notes: slide.notes,
      transition: slide.transition,
      timeline: slide.timeline,
      elements: slide.elements
    })), null, 2) }] };
  });

  server.registerTool("search", {
    description: "Run JavaScript against the SlidePix authoring catalog in `codemode`. Return only the operations or element fields you need. This does not read or write a deck. Example: return codemode.elements.text",
    inputSchema: z.object({ code: z.string().min(1).describe("JavaScript that returns JSON. `codemode` is the catalog.") })
  }, async ({ code }) => textResult(await searchCatalog(code)));

  server.registerTool("execute", {
    description: "Edit one .slidepix.json deck by running JavaScript against slidepix. Call search first when a field is uncertain. ref is a slide id or a 1-based index. Return a small JSON value. The host validates the deck and writes the file only when it changes. It does not copy media bytes.",
    inputSchema: z.object({
      deckPath: selectorSchema.deckPath,
      code: z.string().min(1).describe("JavaScript that uses slidepix and returns JSON."),
      create: z.boolean().optional().describe("Create the file when it does not exist.")
    })
  }, async ({ deckPath, code, create }) => textResult(await executeDeck(deckPath, code, create)));

  return server;
}

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

serveStdio(buildServer);
