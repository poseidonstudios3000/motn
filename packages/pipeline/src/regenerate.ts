import { z } from "zod";
import {
  EditPlanSchema,
  GraphicSchema,
  type EditPlan,
  type Scene,
  type Transcript,
} from "@motn/schema";
import { projectFile, readJson, writeJsonAtomic } from "./paths";
import { llmBackend } from "./env";
import { loadPrompt } from "./llm/prompts";
import { structuredCall, indexedTranscript } from "./llm/client";
import { lintAndSnap } from "./stages/lint";
import { appendPatch } from "./patches";
import type { IngestOutput } from "./stages/ingest";

// Scoped per-scene regenerate: re-plan ONE scene's word range with its
// neighbors as context. The first real edit affordance beyond the textarea —
// directly attacks the forced-full-regeneration failure mode competitors have.

const LlmSceneOnlySchema = z.object({
  layout: z.enum(["talking-head-full", "animation-full", "split"]),
  splitConfig: z
    .object({ side: z.enum(["left", "right", "top"]), ratio: z.number().min(0.3).max(0.7) })
    .nullable(),
  talkingHead: z.object({ zoom: z.enum(["none", "slow-in", "punch-in"]) }).nullable(),
  transitionIn: z.enum(["cut", "fade", "slide", "wipe"]),
  graphic: GraphicSchema.nullable(),
  rationale: z.string(),
});

// Deterministic alternative cycle for mock mode: each regenerate click walks
// the scene through a different treatment.
const mockAlternative = (scene: Scene): Scene => {
  if (scene.graphic && scene.layout === "split") {
    return { ...scene, layout: "animation-full", talkingHead: null, splitConfig: null };
  }
  if (scene.graphic && scene.layout === "animation-full") {
    return {
      ...scene,
      layout: "talking-head-full",
      splitConfig: null,
      talkingHead: { zoom: "slow-in" },
      graphic: null,
    };
  }
  if (scene.graphic) {
    return { ...scene, graphic: null };
  }
  return {
    ...scene,
    layout: "talking-head-full",
    splitConfig: null,
    talkingHead: { zoom: scene.talkingHead?.zoom === "punch-in" ? "none" : "punch-in" },
  };
};

export const regenerateScene = async (
  projectId: string,
  sceneId: string,
): Promise<EditPlan> => {
  const before = EditPlanSchema.parse(readJson(projectFile(projectId, "editplan.json")));
  const transcript = readJson<Transcript>(projectFile(projectId, "transcript.json"));
  const probe = readJson<IngestOutput>(projectFile(projectId, "probe.json"));
  const idx = before.scenes.findIndex((s) => s.id === sceneId);
  if (idx === -1) throw new Error(`No scene with id ${sceneId}`);
  const scene = before.scenes[idx]!;

  let replacement: Scene;
  if (llmBackend() === "mock") {
    replacement = mockAlternative(scene);
  } else {
    const prompt = loadPrompt("plan");
    const neighbors = [before.scenes[idx - 1], before.scenes[idx + 1]]
      .filter(Boolean)
      .map((s) => JSON.stringify({ ...s, rationale: undefined }));
    const sceneWords = transcript.words.slice(scene.startWordIndex, scene.endWordIndex + 1);
    const res = await structuredCall({
      system: prompt.body,
      user: [
        `Regenerate ONE scene of an existing edit plan with a DIFFERENT treatment.`,
        `The scene covers word indices ${scene.startWordIndex}..${scene.endWordIndex}.`,
        `Current treatment (produce something meaningfully different): ${JSON.stringify({ ...scene, rationale: undefined })}`,
        `Neighbor scenes for context (do not change them): ${neighbors.join(" | ")}`,
        ``,
        `SCENE TRANSCRIPT (indexed): ${indexedTranscript(sceneWords)}`,
      ].join("\n"),
      toolName: "emit_scene",
      toolDescription: "Emit the regenerated scene treatment (layout + graphic only).",
      schema: LlmSceneOnlySchema,
    });
    replacement = {
      ...scene,
      ...res.value,
    };
  }

  const rawAfter: EditPlan = {
    ...before,
    scenes: before.scenes.map((s, i) => (i === idx ? replacement : s)),
  };
  const { plan } = lintAndSnap(rawAfter, transcript, probe.durationMs);
  const after = EditPlanSchema.parse(plan);
  writeJsonAtomic(projectFile(projectId, "editplan.json"), after);
  appendPatch(projectId, "regenerate-scene", sceneId, before, after);
  return after;
};
