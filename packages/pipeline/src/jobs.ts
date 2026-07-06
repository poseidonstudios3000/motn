import fs from "node:fs";
import type { Job, StageName, StageStatus } from "@motn/schema";
import { projectFile, readJson, writeJsonAtomic } from "./paths";

const jobFile = (projectId: string) => projectFile(projectId, "job.json");

export const readJob = (projectId: string): Job => readJson<Job>(jobFile(projectId));

export const initJob = (projectId: string, sourceName: string): Job => {
  const job: Job = {
    projectId,
    createdAt: new Date().toISOString(),
    sourceName,
    stages: {},
    renders: [],
  };
  writeJsonAtomic(jobFile(projectId), job);
  return job;
};

export const updateStage = (
  projectId: string,
  stage: StageName,
  patch: Partial<StageStatus>,
): Job => {
  const job = readJob(projectId);
  const prev: StageStatus = job.stages[stage] ?? {
    status: "pending",
    startedAt: null,
    finishedAt: null,
    ms: null,
    costUsd: null,
    error: null,
    note: null,
  };
  job.stages[stage] = { ...prev, ...patch };
  writeJsonAtomic(jobFile(projectId), job);
  return job;
};

export const stageWrap = async <T>(
  projectId: string,
  stage: StageName,
  fn: () => Promise<T>,
): Promise<T> => {
  const startedAt = new Date();
  updateStage(projectId, stage, {
    status: "running",
    startedAt: startedAt.toISOString(),
    error: null,
  });
  try {
    const result = await fn();
    updateStage(projectId, stage, {
      status: "done",
      finishedAt: new Date().toISOString(),
      ms: Date.now() - startedAt.getTime(),
    });
    return result;
  } catch (err) {
    updateStage(projectId, stage, {
      status: "error",
      finishedAt: new Date().toISOString(),
      ms: Date.now() - startedAt.getTime(),
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
};

export const addRender = (
  projectId: string,
  render: Job["renders"][number],
): void => {
  const job = readJob(projectId);
  job.renders = job.renders.filter((r) => r.file !== render.file);
  job.renders.push(render);
  writeJsonAtomic(jobFile(projectId), job);
};

export const noteStage = (projectId: string, stage: StageName, note: string) => {
  updateStage(projectId, stage, { note });
};

export const setStageCost = (projectId: string, stage: StageName, costUsd: number) => {
  const job = readJob(projectId);
  const prev = job.stages[stage]?.costUsd ?? 0;
  updateStage(projectId, stage, { costUsd: prev + costUsd });
};

export const jobExists = (projectId: string) => fs.existsSync(jobFile(projectId));
