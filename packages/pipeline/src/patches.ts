import fs from "node:fs";
import type { EditPlan, PlanPatch } from "@motn/schema";
import { projectFile } from "./paths";
import { sha256 } from "./cache";

// Every human correction lands in patches.jsonl — the correction corpus that
// later powers evals and per-promptVersion patch-rate attribution.
export const appendPatch = (
  projectId: string,
  kind: PlanPatch["kind"],
  sceneId: string | null,
  before: EditPlan,
  after: EditPlan,
) => {
  const patch: PlanPatch = {
    at: new Date().toISOString(),
    kind,
    sceneId,
    promptVersion: before.provenance.promptVersion,
    beforeHash: sha256(JSON.stringify(before)),
    afterHash: sha256(JSON.stringify(after)),
    after,
  };
  fs.appendFileSync(projectFile(projectId, "patches.jsonl"), JSON.stringify(patch) + "\n");
};
