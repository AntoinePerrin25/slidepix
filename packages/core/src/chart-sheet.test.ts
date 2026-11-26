import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { parseChartFile, parseChartTable, seriesColumn, sheetFromChart } from "./chart-sheet.js";
import { chartFromSheet, writeChartSheet } from "./charts.js";
import { elementSchema } from "./schema.js";

describe("chart sheets", () => {
  it("keeps quoted commas and detects semicolons", () => {
    const quoted = parseChartTable("\"Name, region\",Units\n\"North, HQ\",\"1,200\"");
    expect(quoted.headers).toEqual(["Name, region", "Units"]);
    expect(quoted.rows).toEqual([["North, HQ", "1,200"]]);
    const european = parseChartTable("Region;Units\nNord;4");
    expect(european.roles).toEqual(["category", "series"]);
    expect(european.rows).toEqual([["Nord", "4"]]);
    const wide = parseChartTable(["A", ...Array.from({ length: 13 }, (_, index) => `S${index}`)].join(",") + "\n" + Array.from({ length: 14 }, () => "1").join(","));
    expect(wide.truncated).toBe(true);
    expect(wide.headers).toHaveLength(12);
  });

  it("parses a pasted table and ignores a column", () => {
    const parsed = parseChartTable("Region\tThis year\tNote\nNorth\t12\tstable\nSouth\t18\t");
    expect(parsed.roles).toEqual(["category", "series", "series"]);
    const sheet = { headers: parsed.headers, rows: parsed.rows, roles: ["category", "series", "ignore"] as Array<"category" | "series" | "ignore"> };
    const data = chartFromSheet(sheet, [{ name: "This year", color: "#112233" }]);
    expect(data.categories).toEqual(["North", "South"]);
    expect(data.series).toEqual([{ name: "This year", values: [12, 18], color: "#112233" }]);
  });

  it("reads the first worksheet of an xlsx file", () => {
    const bytes = zipSync({
      "xl/workbook.xml": strToU8(`<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>`),
      "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`),
      "xl/sharedStrings.xml": strToU8(`<?xml version="1.0"?><sst><si><t>Nord</t></si><si><t>Ventes</t></si></sst>`),
      "xl/worksheets/sheet1.xml": strToU8(`<?xml version="1.0"?><worksheet><sheetData><row r="1"><c r="A1" t="s"><v>1</v></c><c r="B1" t="inlineStr"><is><t>Units</t></is></c></row><row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2"><v>12.5</v></c></row></sheetData></worksheet>`)
    });
    const parsed = parseChartFile("ventes.xlsx", bytes);
    expect(parsed.headers).toEqual(["Ventes", "Units"]);
    expect(parsed.rows).toEqual([["Nord", "12.5"]]);
  });

  it("does not follow a worksheet path that leaves the package", () => {
    const bytes = zipSync({
      "xl/workbook.xml": strToU8(`<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>`),
      "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="../secret.xml"/></Relationships>`),
      "xl/worksheets/sheet1.xml": strToU8(`<?xml version="1.0"?><worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Hidden</t></is></c></row></sheetData></worksheet>`)
    });
    expect(() => parseChartFile("bad.xlsx", bytes)).toThrow(/could not be read/);
  });

  it("keeps series colors when the sheet is saved onto a chart", () => {
    const element = elementSchema.parse({ id: "sales", morphKey: "sales", type: "chart", chart: "bar", x: 0, y: 0, width: 10, height: 10, categories: ["A"], series: [{ name: "Units", values: [1], color: "#abcdef" }] });
    if (element.type !== "chart") throw new Error("expected a chart");
    writeChartSheet(element, sheetFromChart(["A", "B"], [{ name: "Units", values: [4, 9] }]));
    expect(element.dataLink).toBeUndefined();
    expect(element.series[0]).toMatchObject({ name: "Units", values: [4, 9], color: "#abcdef" });
    expect(seriesColumn(element.sheet!, 0)).toBe(1);
  });
});
