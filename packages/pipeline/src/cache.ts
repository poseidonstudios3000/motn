import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { projectFile, readJson, writeJsonAtomic } from "./paths";

// Every stage is a pure function (inputs on disk) → (artifact on disk),
// memoized by sha256(inputs) + STAGE_VERSION. Bump the version when a stage's
// implementation or prompt changes — only downstream re-runs.

export const STAGE_VERSIONS: Record<string, number> = {
  ingest: 1,
  transcribe: 1,
  analyze: 1,
  plan: 1,
  resolve: 1,
  render: 1,
};

const hashFile = (file: string): string => {
  // Large media files: hash size + first/last 1 MiB — fast and good enough to
  // detect a different upload. Small JSON artifacts: hash full contents.
  const stat = fs.statSync(file);
  const h = crypto.createHash("sha256");
  h.update(String(stat.size));
  if (stat.size <= 4 * 1024 * 1024) {
    h.update(fs.readFileSync(file));
  } else {
    const fd = fs.openSync(file, "r");
    const head = Buffer.alloc(1024 * 1024);
    const tail = Buffer.alloc(1024 * 1024);
    fs.readSync(fd, head, 0, head.length, 0);
    fs.readSync(fd, tail, 0, tail.length, stat.size - tail.length);
    fs.closeSync(fd);
    h.update(head);
    h.update(tail);
  }
  return h.digest("hex");
};

export const inputsHash = (stage: string, files: string[], extra: string[] = []): string => {
  const h = crypto.createHash("sha256");
  h.update(`v${STAGE_VERSIONS[stage] ?? 0}`);
  for (const f of files) h.update(fs.existsSync(f) ? hashFile(f) : `missing:${f}`);
  for (const e of extra) h.update(e);
  return h.digest("hex");
};

const stampFile = (projectId: string, stage: string) =>
  projectFile(projectId, path.join(".stamps", `${stage}.json`));

export const isFresh = (
  projectId: string,
  stage: string,
  hash: string,
  outputs: string[],
): boolean => {
  const stamp = stampFile(projectId, stage);
  if (!fs.existsSync(stamp)) return false;
  if (!outputs.every((o) => fs.existsSync(o))) return false;
  return readJson<{ hash: string }>(stamp).hash === hash;
};

export const writeStamp = (projectId: string, stage: string, hash: string) => {
  writeJsonAtomic(stampFile(projectId, stage), { hash, at: new Date().toISOString() });
};

export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
