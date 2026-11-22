import { describe, expect, it } from "vitest";
import { installedAgentSkills, skillInstallations, skillInstallRoots, skillSourceCandidates } from "./agent-skills";

describe("agent skill install", () => {
  it("writes both skills into the shared user folders", () => {
    expect(skillInstallRoots("/home/pix")).toEqual([
      "/home/pix/.agents/skills",
      "/home/pix/.cursor/skills",
      "/home/pix/.claude/skills"
    ]);
    const installed = skillInstallations("/home/pix");
    expect(installed).toHaveLength(installedAgentSkills.length * 3);
    expect(installed.map((item) => item.destination)).toContain("/home/pix/.agents/skills/slidepix-pres");
    expect(installed.map((item) => item.destination)).toContain("/home/pix/.claude/skills/slidepix-mcp-review");
  });

  it("prefers skills packaged with the extension", () => {
    expect(skillSourceCandidates("/ext")).toEqual([
      "/ext/skills",
      "/.agents/skills"
    ]);
  });
});
