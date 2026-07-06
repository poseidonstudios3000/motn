import { z } from "zod";

// Stamped on every AI-produced artifact so outputs stay attributable to a
// prompt version. Collection starts week 1 — impossible to backfill later.
export const ProvenanceSchema = z.object({
  promptVersion: z.string(), // e.g. "plan@1"
  model: z.string(), // e.g. "claude-opus-4-8" or "mock"
  schemaVersion: z.number().int(),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;
