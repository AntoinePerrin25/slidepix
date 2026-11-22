import { describe, expect, it } from "vitest";
import { chartFromTable, chartMarkup, parseChartNumber } from "./charts.js";

describe("charts", () => {
  it("reads categories and series from a header table", () => {
    const data = chartFromTable({
      id: "table",
      type: "table",
      rows: 3,
      columns: 3,
      headerRow: true,
      cells: [["", "Apples", "Pears"], ["North", "4", "5"], ["South", "2", "9"]]
    });
    expect(data.categories).toEqual(["North", "South"]);
    expect(data.series.map((series) => series.name)).toEqual(["Apples", "Pears"]);
    expect(data.series[1]?.values).toEqual([5, 9]);
  });

  it("parses numbers and draws a bar chart", () => {
    expect(parseChartNumber("1,200")).toBe(1200);
    const svg = chartMarkup({
      chart: "bar",
      categories: ["A", "B"],
      series: [{ name: "One", values: [2, 4] }],
      legend: true,
      valueLabels: false,
      width: 400,
      height: 240
    }, []);
    expect(svg).toContain("<rect");
    expect(svg).toContain("One");
  });
});
