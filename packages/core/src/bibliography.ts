export const CHICAGO_CITATION_FORMAT = "#indent@author (@year). @title. @url.";
export const CHICAGO_INLINE_FORMAT = "(@shortauthor @year)";

export const CITATION_CHEAT_SHEET = [
  "Write [@citation-key] in any slide text. It becomes a short author-date, such as (Smith and Johnson 2024).",
  "Tag one slide as the bibliography. It lists every entry from the reference file, using the format below.",
  "Tokens: @author @shortauthor @number @year @date @title @url @doi @journal @booktitle @publisher @eprint @key.",
  "@author keeps the names written in the file. @shortauthor keeps the family name only, so Smith, John R. and Johnson, Mary L. becomes Smith and Johnson.",
  "@number is the entry position. #sup{...} draws that part as a small superscript, and #small{...} draws it smaller.",
  "#indent inserts the indent setting. 4 means four spaces.",
  "Example: - @author (@date) : @title. @url.",
  "Chicago author-date is the default: #indent@author (@year). @title. @url."
].join(" ");

export type Citation = {
  key: string;
  type: string;
  fields: Record<string, string>;
};

export type BibliographyChoice = "ours" | "theirs";

export type BibliographyMergeConflict = {
  key: string;
  base: string;
  ours: string;
  theirs: string;
};

/** Combine citation entries by key. A key changed on only one side is kept. Both sides changing the same key is a conflict. */
export function mergeBibliographySources(
  base: string,
  ours: string,
  theirs: string,
  choices: ReadonlyMap<string, BibliographyChoice> = new Map()
): { text: string; conflicts: BibliographyMergeConflict[] } {
  const baseEntries = entriesByKey(base);
  const ourEntries = entriesByKey(ours);
  const theirEntries = entriesByKey(theirs);
  const keys = orderedKeys(baseEntries, ourEntries, theirEntries);
  const chosen: Citation[] = [];
  const conflicts: BibliographyMergeConflict[] = [];
  for (const key of keys) {
    const baseBlock = blockOf(baseEntries.get(key));
    const ourBlock = blockOf(ourEntries.get(key));
    const theirBlock = blockOf(theirEntries.get(key));
    const selected = selectBibliographyEntry(baseBlock, ourBlock, theirBlock, choices.get(key));
    if (selected.conflict) conflicts.push({ key, base: baseBlock, ours: ourBlock, theirs: theirBlock });
    const entry = selected.side === "base" ? baseEntries.get(key) : selected.side === "theirs" ? theirEntries.get(key) : ourEntries.get(key);
    if (entry) chosen.push(entry);
  }
  const text = serializeBibliography(chosen);
  if (!conflicts.length && sameEntries(baseEntries, ourEntries) && sameEntries(baseEntries, theirEntries)) return { text: base, conflicts };
  if (!conflicts.length && sameEntries(baseEntries, ourEntries)) return { text: theirs, conflicts };
  if (!conflicts.length && sameEntries(baseEntries, theirEntries)) return { text: ours, conflicts };
  return { text, conflicts };
}

export function serializeBibliography(entries: readonly Citation[]): string {
  return entries.map(bibliographyEntryBlock).filter(Boolean).join("\n\n");
}

export function bibliographyEntryBlock(entry: Citation): string {
  const fields = Object.entries(entry.fields).map(([name, value]) => `  ${name}={${value}}`);
  return `@${entry.type}{${entry.key}${fields.length ? `,\n${fields.join(",\n")}` : ""}\n}`;
}

function selectBibliographyEntry(base: string, ours: string, theirs: string, choice: BibliographyChoice | undefined): { side: "base" | "ours" | "theirs"; conflict: boolean } {
  if (ours === theirs) return { side: "ours", conflict: false };
  if (ours === base) return { side: "theirs", conflict: false };
  if (theirs === base) return { side: "ours", conflict: false };
  if (choice === "theirs") return { side: "theirs", conflict: false };
  if (choice === "ours") return { side: "ours", conflict: false };
  return { side: "ours", conflict: true };
}

function entriesByKey(source: string): Map<string, Citation> {
  const entries = new Map<string, Citation>();
  for (const entry of parseBibliography(source)) entries.set(entry.key, entry);
  return entries;
}

function blockOf(entry: Citation | undefined): string {
  return entry ? bibliographyEntryBlock(entry) : "";
}

function sameEntries(left: Map<string, Citation>, right: Map<string, Citation>): boolean {
  if (left.size !== right.size) return false;
  for (const [key, entry] of left) if (blockOf(entry) !== blockOf(right.get(key))) return false;
  return true;
}

function orderedKeys(...maps: Map<string, Citation>[]): string[] {
  const keys: string[] = [];
  for (const map of maps) for (const key of map.keys()) if (!keys.includes(key)) keys.push(key);
  return keys;
}

export function parseBibliography(source: string): Citation[] {
  const entries: Citation[] = [];
  let index = 0;
  while (index < source.length) {
    const at = source.indexOf("@", index);
    if (at < 0) break;
    if (source[at - 1] === "\\") {
      index = at + 1;
      continue;
    }
    let cursor = at + 1;
    while (cursor < source.length && /[A-Za-z]/.test(source[cursor] ?? "")) cursor += 1;
    const type = source.slice(at + 1, cursor).toLowerCase();
    while (cursor < source.length && /\s/.test(source[cursor] ?? "")) cursor += 1;
    if (source[cursor] !== "{") {
      index = Math.max(cursor, at + 1);
      continue;
    }
    const body = readBrace(source, cursor);
    if (!body) break;
    index = body.end;
    if (type === "comment" || type === "preamble" || type === "string" || !type) continue;
    const comma = body.text.indexOf(",");
    if (comma < 0) continue;
    const key = body.text.slice(0, comma).trim();
    if (!key) continue;
    entries.push({ key, type, fields: parseFields(body.text.slice(comma + 1)) });
  }
  return entries;
}

const citationMarker = /\[@([A-Za-z0-9_.:-]+)\]/g;

type CitationSource = {
  hidden: boolean;
  elements: readonly {
    hidden: boolean;
    type: string;
    x: number;
    y: number;
    markdown?: string;
    cells?: readonly (readonly string[])[];
  }[];
};

/** Citations in first-appearance order, top to bottom across visible slides. */
export function citedEntries(slides: readonly CitationSource[], entries: readonly Citation[]): Citation[] {
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));
  const seen = new Set<string>();
  const ordered: Citation[] = [];
  for (const slide of slides) {
    if (slide.hidden) continue;
    const elements = slide.elements
      .map((element, index) => ({ element, index }))
      .filter((item) => !item.element.hidden)
      .sort((left, right) => left.element.y - right.element.y || left.element.x - right.element.x || left.index - right.index);
    for (const { element } of elements) {
      const chunks = element.type === "text" && element.markdown
        ? [element.markdown]
        : element.type === "table"
          ? (element.cells ?? []).flatMap((row) => [...row])
          : [];
      for (const chunk of chunks) {
        for (const match of chunk.matchAll(citationMarker)) {
          const key = match[1] ?? "";
          if (!key || seen.has(key)) continue;
          const entry = byKey.get(key);
          if (!entry) continue;
          seen.add(key);
          ordered.push(entry);
        }
      }
    }
  }
  return ordered;
}

export function bibliographyBody(entries: readonly Citation[], template: string, indent: number, hasReference: boolean): string {
  if (entries.length) return formatBibliography(entries, template, indent);
  return hasReference ? "No citations are used in the slides." : "Choose a reference file in the Bibliography tab.";
}

export function formatBibliography(entries: readonly Citation[], template: string, indent: number): string {
  return entries.map((entry, index) => formatCitation(entry, template, indent, { number: index + 1 })).join("\n");
}

export function formatCitation(entry: Citation, template: string, indent: number, options?: { number?: number; markup?: boolean }): string {
  const spaces = " ".repeat(clampIndent(indent));
  const values: Record<string, string> = {
    author: formatAuthor(citationField(entry, "author"), "bibliography"),
    shortauthor: formatAuthor(citationField(entry, "author"), "inline"),
    number: options?.number ? String(options.number) : "",
    year: yearOf(entry),
    date: citationField(entry, "date") || yearOf(entry),
    title: citationField(entry, "title"),
    url: citationField(entry, "url"),
    doi: citationField(entry, "doi"),
    journal: citationField(entry, "journal"),
    booktitle: citationField(entry, "booktitle"),
    publisher: citationField(entry, "publisher"),
    eprint: citationField(entry, "eprint"),
    key: entry.key,
    type: entry.type
  };
  const indentMark = "\u0000";
  let text = (template.trim() ? template : CHICAGO_CITATION_FORMAT).replaceAll("#indent", indentMark);
  text = text.replace(/@([A-Za-z]+)/g, (_match, name: string) => values[name.toLowerCase()] ?? "");
  text = text.replace(/[ \t]{2,}/g, " ");
  text = text.replaceAll(indentMark, spaces);
  text = text.replace(/[ \t]+\./g, ".");
  text = text.replace(/\.{2,}/g, (dots, offset, source) => (source[offset - 1] === ":" ? dots : "."));
  return normalizeCitationMarkup(text.replace(/[ \t]+$/gm, "").trimEnd(), options?.markup === true);
}

export function expandCitationMarkers(source: string, entries: readonly Citation[], template = CHICAGO_INLINE_FORMAT, indent = 0): string {
  return source.replace(/\[@([A-Za-z0-9_.:-]+)\]/g, (match, key: string) => {
    const index = entries.findIndex((item) => item.key === key);
    const entry = entries[index];
    return entry ? formatCitation(entry, template, indent, { number: index + 1, markup: true }) : match;
  });
}

export function inlineCitation(entry: Citation): string {
  return formatCitation(entry, CHICAGO_INLINE_FORMAT, 0, { number: 1 });
}

function normalizeCitationMarkup(source: string, markup: boolean): string {
  let current = source;
  for (;;) {
    const next = current.replace(/#(?:sup|small)\{([^{}]*)\}/g, (_match, inner: string) => {
      if (!inner.trim()) return "";
      return markup ? _match : inner;
    });
    if (next === current) return current;
    current = next;
  }
}

export function citationField(entry: Citation, name: string): string {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(entry.fields)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return "";
}

function yearOf(entry: Citation): string {
  const year = citationField(entry, "year");
  if (year) return year;
  return citationField(entry, "date").match(/\d{4}/)?.[0] ?? "";
}

function formatAuthor(raw: string, style: "bibliography" | "inline"): string {
  const people = raw.split(/\s+and\s+/i).map((person) => person.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (!people.length) return "";
  if (style === "inline") {
    const lasts = people.map(lastName);
    if (lasts.length === 1) return lasts[0] ?? "";
    if (lasts.length === 2) return `${lasts[0]} and ${lasts[1]}`;
    return `${lasts.slice(0, -1).join(", ")}, and ${lasts.at(-1)}`;
  }
  if (people.length === 1) return people[0] ?? "";
  if (people.length === 2) return `${people[0]}, and ${people[1]}`;
  return `${people.slice(0, -1).join(", ")}, and ${people.at(-1)}`;
}

function lastName(person: string): string {
  const comma = person.indexOf(",");
  if (comma >= 0) return person.slice(0, comma).trim();
  return person.split(/\s+/).at(-1) ?? person;
}

function parseFields(source: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let index = 0;
  while (index < source.length) {
    while (index < source.length && /[\s,]/.test(source[index] ?? "")) index += 1;
    if (index >= source.length) break;
    const start = index;
    while (index < source.length && /[A-Za-z0-9_-]/.test(source[index] ?? "")) index += 1;
    const name = source.slice(start, index).trim();
    while (index < source.length && /\s/.test(source[index] ?? "")) index += 1;
    if (!name || source[index] !== "=") {
      index += 1;
      continue;
    }
    index += 1;
    while (index < source.length && /\s/.test(source[index] ?? "")) index += 1;
    const value = readValue(source, index);
    if (!value) break;
    fields[name] = cleanField(value.text);
    index = value.end;
  }
  return fields;
}

function readValue(source: string, index: number): { text: string; end: number } | undefined {
  const opener = source[index];
  if (opener === "{") {
    const body = readBrace(source, index);
    return body ? { text: body.text, end: body.end } : undefined;
  }
  if (opener === "\"") {
    let cursor = index + 1;
    let text = "";
    while (cursor < source.length) {
      const character = source[cursor] ?? "";
      if (character === "\\" && cursor + 1 < source.length) {
        text += source[cursor + 1];
        cursor += 2;
        continue;
      }
      if (character === "\"") return { text, end: cursor + 1 };
      text += character;
      cursor += 1;
    }
    return { text, end: source.length };
  }
  let cursor = index;
  while (cursor < source.length && !/[\s,]/.test(source[cursor] ?? "")) cursor += 1;
  return { text: source.slice(index, cursor), end: cursor };
}

function readBrace(source: string, openIndex: number): { text: string; end: number } | undefined {
  let depth = 0;
  let text = "";
  for (let index = openIndex; index < source.length; index += 1) {
    const character = source[index] ?? "";
    if (character === "{") {
      if (depth > 0) text += character;
      depth += 1;
      continue;
    }
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return { text, end: index + 1 };
      text += character;
      continue;
    }
    if (depth > 0) text += character;
  }
  return undefined;
}

function cleanField(value: string): string {
  return value.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
}

function clampIndent(indent: number): number {
  if (!Number.isFinite(indent)) return 0;
  return Math.max(0, Math.min(32, Math.trunc(indent)));
}
