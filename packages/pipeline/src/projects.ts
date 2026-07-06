import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PROJECTS_DIR, projectDir, projectFile } from "./paths";
import { initJob } from "./jobs";

export const createProject = (sourceVideoPath: string): string => {
  if (!fs.existsSync(sourceVideoPath)) {
    throw new Error(`No such file: ${sourceVideoPath}`);
  }
  const id = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
  fs.mkdirSync(projectDir(id), { recursive: true });
  fs.copyFileSync(sourceVideoPath, projectFile(id, "source.mp4"));
  // Optional sidecar used by the mock transcriber (offline dev/demo):
  const sidecar = sourceVideoPath.replace(/\.[^.]+$/, ".script.txt");
  if (fs.existsSync(sidecar)) {
    fs.copyFileSync(sidecar, projectFile(id, "source.script.txt"));
  }
  initJob(id, path.basename(sourceVideoPath));
  return id;
};

export const createProjectFromBuffer = (buf: Buffer, originalName: string): string => {
  const id = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
  fs.mkdirSync(projectDir(id), { recursive: true });
  fs.writeFileSync(projectFile(id, "source.mp4"), buf);
  initJob(id, originalName);
  return id;
};

export const listProjects = (): string[] => {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs
    .readdirSync(PROJECTS_DIR)
    .filter((d) => fs.existsSync(path.join(PROJECTS_DIR, d, "job.json")))
    .sort()
    .reverse();
};
