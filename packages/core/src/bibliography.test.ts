import { describe, expect, it } from "vitest";
import {
  CHICAGO_CITATION_FORMAT,
  citedEntries,
  expandCitationMarkers,
  formatCitation,
  inlineCitation,
  mergeBibliographySources,
  parseBibliography
} from "./bibliography.js";

const SAMPLE = `@misc{smith2024quantum,
    title={Quantum Computing Advances in Machine Learning},
    author={Smith, John R. and Johnson, Mary L.},
    year={2024},
    eprint={2401.12345},
    archivePrefix={arXiv},
    primaryClass={quant-ph},
    doi={10.48550/arXiv.2401.12345},
    url={https://arxiv.org/abs/2401.12345}
}`;

describe("bibliography", () => {
  it("parses a BibTeX entry and formats it", () => {
    const [entry] = parseBibliography(SAMPLE);
    expect(entry).toMatchObject({ key: "smith2024quantum", type: "misc" });
    expect(formatCitation(entry!, "- @author (@date) : @title. @url.", 4)).toBe(
      "- Smith, John R., and Johnson, Mary L. (2024) : Quantum Computing Advances in Machine Learning. https://arxiv.org/abs/2401.12345."
    );
    expect(formatCitation(entry!, CHICAGO_CITATION_FORMAT, 4)).toBe(
      "    Smith, John R., and Johnson, Mary L. (2024). Quantum Computing Advances in Machine Learning. https://arxiv.org/abs/2401.12345."
    );
    expect(inlineCitation(entry!)).toBe("(Smith and Johnson 2024)");
    expect(formatCitation(entry!, "@author", 0)).toContain("Smith, John R., and Johnson, Mary L.");
    expect(expandCitationMarkers("[@smith2024quantum]", [entry!], "#sup{@number} (@author @year)", 0)).toBe("#sup{1} (Smith, John R., and Johnson, Mary L. 2024)");
  });

  it("numbers citations by first appearance and keeps only those", () => {
    const slides = [{
      hidden: false,
      elements: [
        { hidden: false, type: "text", x: 0, y: 10, markdown: "See [@alpha]." },
        { hidden: false, type: "text", x: 0, y: 400, markdown: "[@beta] and [@alpha]." },
        { hidden: true, type: "text", x: 0, y: 0, markdown: "[@gamma]" }
      ]
    }];
    const entries = parseBibliography("@misc{gamma, title={Gamma}}\n@misc{alpha, title={Alpha}}\n@misc{beta, title={Beta}}\n@misc{unused, title={Unused}}");
    const cited = citedEntries(slides, entries);
    expect(cited.map((entry) => entry.key)).toEqual(["alpha", "beta"]);
    expect(expandCitationMarkers("[@beta] [@alpha]", cited, "@number", 0)).toBe("2 1");
  });

  it("keeps citation entries added on either side", () => {
    const base = "";
    const ours = "@misc{alpha, title={Alpha}, year={2020}}";
    const theirs = "@misc{beta, title={Beta}, year={2021}}";
    const merged = mergeBibliographySources(base, ours, theirs);
    expect(merged.conflicts).toEqual([]);
    expect(parseBibliography(merged.text).map((entry) => entry.key)).toEqual(["alpha", "beta"]);
    const clash = mergeBibliographySources(base, "@misc{alpha, title={One}}", "@misc{alpha, title={Two}}");
    expect(clash.conflicts.map((conflict) => conflict.key)).toEqual(["alpha"]);
  });

  it("replaces only known citation markers", () => {
    const entries = parseBibliography(SAMPLE);
    expect(expandCitationMarkers("See [@smith2024quantum] and [@missing].", entries)).toBe(
      "See (Smith and Johnson 2024) and [@missing]."
    );
  });
});
