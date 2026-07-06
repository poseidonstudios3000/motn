import { z } from "zod";

// Every human correction to an AI-produced plan, logged to patches.jsonl.
// This is the correction corpus that later powers evals and prompt A/B
// attribution ("patch-rate per component per promptVersion") — cheap to
// collect now, impossible to backfill.
export const PlanPatchSchema = z.object({
  at: z.string(), // ISO timestamp
  kind: z.enum([
    "textarea-edit",
    "regenerate-scene",
    "replan",
    "caption-toggle",
    "caption-position",
    "other",
  ]),
  sceneId: z.string().nullable(),
  promptVersion: z.string(), // provenance of the plan being edited
  beforeHash: z.string(),
  afterHash: z.string(),
  after: z.unknown(), // full post-edit plan snapshot (plans are small; jsonl is cheap)
});
export type PlanPatch = z.infer<typeof PlanPatchSchema>;
