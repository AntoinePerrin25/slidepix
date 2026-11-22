/** Native bar, line, area, and pie charts, including values read from a slide table. */

const PALETTE = ["#2563eb", "#f97316", "#16a34a", "#9333ea", "#e11d48", "#0891b2", "#ca8a04", "#475569"];

export type ChartKind = "bar" | "line" | "area" | "pie";
export type ChartSeries = { name: string; values: number[]; color?: string };
export type ChartModel = {
  chart: ChartKind;
  categories: string[];
  series: ChartSeries[];
  legend: boolean;
  valueLabels: boolean;
  width: number;
  height: number;
  dataLink?: { elementId: string };
};

export type ChartTable = {
  id: string;
  type: "table";
  rows: number;
  columns: number;
  cells: string[][];
  headerRow: boolean;
};

export type ResolvedChart = {
  categories: string[];
  series: { name: string; values: number[]; color: string }[];
};

export function resolveChartData(element: ChartModel, tables: readonly ChartTable[]): ResolvedChart {
  const linked = element.dataLink ? tables.find((table) => table.id === element.dataLink?.elementId) : undefined;
  const resolved = linked ? chartFromTable(linked) : {
    categories: element.categories,
    series: element.series.map((series, index) => ({
      name: series.name || `Series ${index + 1}`,
      values: series.values,
      color: series.color || PALETTE[index % PALETTE.length]!
    }))
  };
  if (!resolved.series.length) {
    resolved.series.push({ name: "Series", values: resolved.categories.map(() => 0), color: PALETTE[0]! });
  }
  return resolved;
}

export function chartFromTable(table: ChartTable): ResolvedChart {
  const start = table.headerRow ? 1 : 0;
  const categories: string[] = [];
  for (let row = start; row < table.rows; row += 1) categories.push(cellText(table, row, 0) || `${row + 1}`);
  const series: ResolvedChart["series"] = [];
  for (let column = 1; column < table.columns; column += 1) {
    const values: number[] = [];
    for (let row = start; row < table.rows; row += 1) values.push(parseChartNumber(cellText(table, row, column)));
    series.push({
      name: table.headerRow ? cellText(table, 0, column) || `Series ${column}` : `Series ${column}`,
      values,
      color: PALETTE[(column - 1) % PALETTE.length]!
    });
  }
  return { categories, series };
}

export function parseChartNumber(value: string): number {
  const parsed = Number(value.trim().replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function chartMarkup(element: ChartModel, tables: readonly ChartTable[]): string {
  const data = resolveChartData(element, tables);
  const width = Math.max(1, element.width);
  const height = Math.max(1, element.height);
  const body = element.chart === "pie" ? pieChart(data, width, height, element.valueLabels) : cartesianChart(element.chart, data, width, height, element.legend, element.valueLabels);
  return `<svg class="slidepix-chart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${trim(width)} ${trim(height)}" role="img">${body}</svg>`;
}

function cartesianChart(kind: Exclude<ChartKind, "pie">, data: ResolvedChart, width: number, height: number, legend: boolean, labels: boolean): string {
  const legendHeight = legend ? 32 : 8;
  const left = 52;
  const right = 16;
  const top = 16;
  const bottom = 36 + legendHeight;
  const plotW = Math.max(1, width - left - right);
  const plotH = Math.max(1, height - top - bottom);
  const values = data.series.flatMap((series) => series.values);
  const max = Math.max(0, ...values, 1);
  const min = Math.min(0, ...values);
  const span = Math.max(1e-6, max - min);
  const yOf = (value: number) => top + ((max - value) / span) * plotH;
  const baseline = yOf(0);
  const count = Math.max(1, data.categories.length);
  const slot = plotW / count;
  const parts = [`<line x1="${left}" y1="${trim(baseline)}" x2="${trim(left + plotW)}" y2="${trim(baseline)}" stroke="#cbd5e1" stroke-width="1"/>`];
  parts.push(`<text x="${left - 8}" y="${top + 4}" text-anchor="end" font-size="12" fill="#64748b">${escapeText(formatTick(max))}</text>`);
  parts.push(`<text x="${left - 8}" y="${trim(top + plotH)}" text-anchor="end" font-size="12" fill="#64748b">${escapeText(formatTick(min))}</text>`);
  data.categories.forEach((category, index) => {
    const center = left + slot * index + slot / 2;
    parts.push(`<text x="${trim(center)}" y="${trim(top + plotH + 18)}" text-anchor="middle" font-size="12" fill="#334155">${escapeText(shorten(category))}</text>`);
  });
  if (kind === "bar") {
    const barWidth = Math.max(1, (slot * 0.72) / data.series.length);
    data.series.forEach((series, seriesIndex) => {
      data.categories.forEach((_, index) => {
        const value = series.values[index] ?? 0;
        const y = Math.min(yOf(value), baseline);
        const barHeight = Math.max(0, Math.abs(yOf(value) - baseline));
        const x = left + slot * index + slot * 0.14 + barWidth * seriesIndex;
        parts.push(`<rect x="${trim(x)}" y="${trim(y)}" width="${trim(barWidth - 2)}" height="${trim(barHeight)}" fill="${series.color}"/>`);
        if (labels) parts.push(`<text x="${trim(x + barWidth / 2)}" y="${trim(y - 4)}" text-anchor="middle" font-size="11" fill="#111827">${escapeText(formatTick(value))}</text>`);
      });
    });
  } else {
    data.series.forEach((series) => {
      const points = data.categories.map((_, index) => {
        const x = left + slot * index + slot / 2;
        const y = yOf(series.values[index] ?? 0);
        return { x, y };
      });
      const line = points.map((point) => `${trim(point.x)},${trim(point.y)}`).join(" ");
      if (kind === "area" && points.length) {
        const floor = `${trim(points[0]!.x)},${trim(baseline)} ${line} ${trim(points.at(-1)!.x)},${trim(baseline)}`;
        parts.push(`<polygon points="${floor}" fill="${series.color}" opacity="0.25"/>`);
      }
      parts.push(`<polyline points="${line}" fill="none" stroke="${series.color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`);
      points.forEach((point, index) => {
        parts.push(`<circle cx="${trim(point.x)}" cy="${trim(point.y)}" r="3.5" fill="${series.color}"/>`);
        if (labels) parts.push(`<text x="${trim(point.x)}" y="${trim(point.y - 8)}" text-anchor="middle" font-size="11" fill="#111827">${escapeText(formatTick(series.values[index] ?? 0))}</text>`);
      });
    });
  }
  if (legend) parts.push(legendMarkup(data, width, height));
  return parts.join("");
}

function pieChart(data: ResolvedChart, width: number, height: number, labels: boolean): string {
  const series = data.series[0]!;
  const values = series.values.map((value) => Math.max(0, value));
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  const cx = width * 0.38;
  const cy = height * 0.48;
  const radius = Math.max(8, Math.min(width, height) * 0.32);
  let angle = -Math.PI / 2;
  const parts: string[] = [];
  values.forEach((value, index) => {
    const sweep = (value / total) * Math.PI * 2;
    const next = angle + sweep;
    const color = data.series[index]?.color ?? PALETTE[index % PALETTE.length]!;
    parts.push(`<path d="${wedge(cx, cy, radius, angle, next)}" fill="${color}"/>`);
    if (labels && value > 0) {
      const mid = angle + sweep / 2;
      parts.push(`<text x="${trim(cx + Math.cos(mid) * radius * 0.62)}" y="${trim(cy + Math.sin(mid) * radius * 0.62)}" text-anchor="middle" font-size="12" fill="#fff">${escapeText(formatTick(value))}</text>`);
    }
    angle = next;
  });
  data.categories.forEach((category, index) => {
    const color = PALETTE[index % PALETTE.length]!;
    const y = 28 + index * 22;
    parts.push(`<rect x="${trim(width * 0.72)}" y="${y - 12}" width="12" height="12" fill="${color}"/>`);
    parts.push(`<text x="${trim(width * 0.72 + 18)}" y="${y}" font-size="13" fill="#111827">${escapeText(shorten(category))}</text>`);
  });
  return parts.join("");
}

function wedge(cx: number, cy: number, radius: number, start: number, end: number): string {
  const x1 = cx + Math.cos(start) * radius;
  const y1 = cy + Math.sin(start) * radius;
  const x2 = cx + Math.cos(end) * radius;
  const y2 = cy + Math.sin(end) * radius;
  const large = end - start > Math.PI ? 1 : 0;
  if (end - start >= Math.PI * 2 - 0.001) return `M ${trim(cx - radius)} ${trim(cy)} A ${trim(radius)} ${trim(radius)} 0 1 1 ${trim(cx + radius)} ${trim(cy)} A ${trim(radius)} ${trim(radius)} 0 1 1 ${trim(cx - radius)} ${trim(cy)}`;
  return `M ${trim(cx)} ${trim(cy)} L ${trim(x1)} ${trim(y1)} A ${trim(radius)} ${trim(radius)} 0 ${large} 1 ${trim(x2)} ${trim(y2)} Z`;
}

function legendMarkup(data: ResolvedChart, width: number, height: number): string {
  const gap = width / Math.max(1, data.series.length);
  return data.series.map((series, index) => {
    const x = 16 + index * gap;
    return `<rect x="${trim(x)}" y="${trim(height - 22)}" width="12" height="12" fill="${series.color}"/><text x="${trim(x + 18)}" y="${trim(height - 11)}" font-size="13" fill="#111827">${escapeText(shorten(series.name))}</text>`;
  }).join("");
}

function cellText(table: ChartTable, row: number, column: number): string {
  return table.cells[row]?.[column]?.trim() ?? "";
}

function formatTick(value: number): string {
  if (Math.abs(value) >= 1000) return `${Math.round(value)}`;
  return String(Math.round(value * 100) / 100);
}

function shorten(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 18 ? `${text.slice(0, 17)}…` : text;
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function trim(value: number): string {
  return String(Math.round(value * 100) / 100);
}
