import * as path from "node:path";

/** Skills installed for every project. `slidepix-development` stays in the repository. */
export const installedAgentSkills = ["slidepix-pres", "slidepix-mcp-review"] as const;

/** User-level folders read by Cursor, Codex, and Claude Code. */
export function skillInstallRoots(home: string): string[] {
  return [
    path.join(home, ".agents", "skills"),
    path.join(home, ".cursor", "skills"),
    path.join(home, ".claude", "skills")
  ];
}

export function skillSourceCandidates(extensionPath: string): string[] {
  return [
    path.join(extensionPath, "skills"),
    path.join(extensionPath, "..", "..", ".agents", "skills")
  ];
}

export function skillInstallations(home: string): { name: string; destination: string }[] {
  return skillInstallRoots(home).flatMap((root) => installedAgentSkills.map((name) => ({
    name,
    destination: path.join(root, name)
  })));
}
