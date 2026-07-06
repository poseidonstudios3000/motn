import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../paths";

// Anchored to the repo root (not import.meta.url) so prompt loading works
// identically from tsx, vitest, and webpack-bundled server code.
const promptsDir = path.join(REPO_ROOT, "packages", "pipeline", "src", "llm", "prompts");

export type Prompt = { name: string; version: string; body: string };

// Prompts are versioned files with frontmatter. The version is stamped into
// every artifact's provenance so outputs stay attributable.
export const loadPrompt = (name: string): Prompt => {
  const raw = fs.readFileSync(path.join(promptsDir, `${name}.md`), "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error(`Prompt ${name}.md is missing frontmatter`);
  const versionLine = m[1]!.match(/version:\s*(\S+)/);
  if (!versionLine) throw new Error(`Prompt ${name}.md frontmatter is missing version`);
  return {
    name,
    version: `${name}@${versionLine[1]}`,
    body: raw.slice(m[0].length).trim(),
  };
};
