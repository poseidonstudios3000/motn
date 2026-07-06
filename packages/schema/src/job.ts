import { z } from "zod";

export const STAGES = [
  "ingest",
  "transcribe",
  "analyze",
  "plan",
  "resolve",
  "render",
] as const;
export type StageName = (typeof STAGES)[number];

export const StageStatusSchema = z.object({
  status: z.enum(["pending", "running", "done", "error"]),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  ms: z.number().nullable(),
  costUsd: z.number().nullable(),
  error: z.string().nullable(),
  note: z.string().nullable(), // e.g. "captions-only fallback", "cache hit"
});
export type StageStatus = z.infer<typeof StageStatusSchema>;

export const JobSchema = z.object({
  projectId: z.string(),
  createdAt: z.string(),
  sourceName: z.string(),
  stages: z.record(z.string(), StageStatusSchema),
  renders: z.array(
    z.object({
      file: z.string(),
      resolution: z.enum(["720p", "1080p"]),
      at: z.string(),
      ms: z.number(),
    }),
  ),
});
export type Job = z.infer<typeof JobSchema>;
