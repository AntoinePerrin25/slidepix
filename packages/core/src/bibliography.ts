export const CHICAGO_CITATION_FORMAT = "#indent@author (@year). @title. @url.";

export const CITATION_CHEAT_SHEET = [
  "Write [@citation-key] in any slide text. It becomes a short author-date, such as (Smith and Johnson 2024).",
  "Tag one slide as the bibliography. It lists every entry from the reference file, using the format below.",
  "Tokens: @author @year @date @title @url @doi @journal @booktitle @publisher @eprint @key.",
  "#indent inserts the indent setting. 4 means four spaces.",
  "Example: - @author (@date) : @title. @url.",
  "Chicago author-date is the default: #indent@author (@year). @title. @url."
].join(" ");

export type Citation = {
  key: string;
  type: string;
  fields: Record<string, string>;
};

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

export function formatBibliography(entries: readonly Citation[], template: string, indent: number): string {
  return entries.map((entry) => formatCitation(entry, template, indent)).join("\n");
}

export function formatCitation(entry: Citation, template: string, indent: number): string {
  const spaces = " ".repeat(clampIndent(indent));
  const values: Record<string, string> = {
    author: formatAuthor(citationField(entry, "author"), "bibliography"),
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
  return text.replace(/[ \t]+$/gm, "").trimEnd();
}

export function expandCitationMarkers(source: string, entries: readonly Citation[]): string {
  return source.replace(/\[@([A-Za-z0-9_.:-]+)\]/g, (match, key: string) => {
    const entry = entries.find((item) => item.key === key);
    return entry ? inlineCitation(entry) : match;
  });
}

export function inlineCitation(entry: Citation): string {
  const author = formatAuthor(citationField(entry, "author"), "inline");
  const year = yearOf(entry);
  const body = [author, year].filter(Boolean).join(" ");
  return body ? `(${body})` : `(@${entry.key})`;
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
