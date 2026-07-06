import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Works both from source (tsx/vitest) and when bundled into another app's
// server chunks (Next) — every candidate lives somewhere under the repo, so
// walking up finds the workspace root either way.
const candidates = (): string[] => {
  const list = [process.cwd()];
  try {
    list.unshift(path.dirname(fileURLToPath(import.meta.url)));
  } catch {
    // bundled context without import.meta.url support
  }
  return list;
};

export const findRepoRoot = (): string => {
  for (const start of candidates()) {
    let dir = start;
    while (dir !== path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
      dir = path.dirname(dir);
    }
  }
  throw new Error("Could not locate repo root (pnpm-workspace.yaml)");
};

export const REPO_ROOT = findRepoRoot();
export const DATA_DIR = path.join(REPO_ROOT, "data");
export const PROJECTS_DIR = path.join(DATA_DIR, "projects");
export const CACHE_DIR = path.join(DATA_DIR, "cache");
export const VIDEO_PKG_DIR = path.join(REPO_ROOT, "packages", "video");

export const projectDir = (projectId: string) => path.join(PROJECTS_DIR, projectId);

export const projectFile = (projectId: string, name: string) =>
  path.join(projectDir(projectId), name);

export const readJson = <T>(file: string): T =>
  JSON.parse(fs.readFileSync(file, "utf8")) as T;

export const writeJsonAtomic = (file: string, value: unknown) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
};
