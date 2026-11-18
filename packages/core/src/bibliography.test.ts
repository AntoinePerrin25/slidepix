import { describe, expect, it } from "vitest";
import {
  CHICAGO_CITATION_FORMAT,
  expandCitationMarkers,
  formatCitation,
  inlineCitation,
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
  });

  it("replaces only known citation markers", () => {
    const entries = parseBibliography(SAMPLE);
    expect(expandCitationMarkers("See [@smith2024quantum] and [@missing].", entries)).toBe(
      "See (Smith and Johnson 2024) and [@missing]."
    );
  });
});
