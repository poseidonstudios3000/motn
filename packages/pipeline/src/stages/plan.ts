import fs from "node:fs";
import { z } from "zod";
import {
  AnalysisSchema,
  CaptionsConfigSchema,
  EditPlanSchema,
  GraphicSchema,
  type Analysis,
  type EditPlan,
  type Transcript,
} from "@motn/schema";
import { projectFile, readJson, writeJsonAtomic } from "../paths";
import { llmBackend, llmModel } from "../env";
import { loadPrompt } from "../llm/prompts";
import { structuredCall, indexedTranscript } from "../llm/client";
import { setStageCost, noteStage } from "../jobs";
import { lintAndSnap, captionsOnlyPlan } from "./lint";
import { mockPlan } from "./mock-plan";
import type { IngestOutput } from "./ingest";
import { COMPOSITION_FPS } from "./ingest";

// What the LLM emits: the plan minus everything we stamp deterministically.
// Scenes come without ms timing — the lint/snap stage owns index→ms.
const LlmSceneSchema = z.object({
  id: z.string().min(1),
  startWordIndex: z.number().int().nonnegative(),
  endWordIndex: z.number().int().nonnegative(),
  layout: z.enum(["talking-head-full", "animation-full", "split"]),
  splitConfig: z
    .object({ side: z.enum(["left", "right", "top"]), ratio: z.number().min(0.3).max(0.7) })
    .nullable(),
  talkingHead: z.object({ zoom: z.enum(["none", "slow-in", "punch-in"]) }).nullable(),
  transitionIn: z.enum(["cut", "fade", "slide", "wipe"]),
  graphic: GraphicSchema.nullable(),
  rationale: z.string(),
});

const LlmPlanSchema = z.object({
  style: z.object({
    theme: z.enum(["editorial-dark"]),
    motionIntensity: z.enum(["punchy", "subtle"]),
  }),
  captions: CaptionsConfigSchema,
  scenes: z.array(LlmSceneSchema).min(1),
});

export type UserPrefs = {
  captions?: { enabled?: boolean; position?: "top-center" | "bottom" };
};

const readPrefs = (projectId: string): UserPrefs => {
  const f = projectFile(projectId, "prefs.json");
  return fs.existsSync(f) ? readJson<UserPrefs>(f) : {};
};

const applyPrefs = (plan: EditPlan, prefs: UserPrefs): EditPlan => {
  const captions = { ...plan.captions };
  if (prefs.captions?.enabled !== undefined) captions.enabled = prefs.captions.enabled;
  if (prefs.captions?.position !== undefined) captions.position = prefs.captions.position;
  return { ...plan, captions };
};

export const runPlan = async (projectId: string): Promise<EditPlan> => {
  const transcript = readJson<Transcript>(projectFile(projectId, "transcript.json"));
  const analysis = AnalysisSchema.parse(
    readJson<Analysis>(projectFile(projectId, "analysis.json")),
  );
  const probe = readJson<IngestOutput>(projectFile(projectId, "probe.json"));
  const prefs = readPrefs(projectId);
  const source: EditPlan["source"] = {
    durationMs: probe.durationMs,
    fps: COMPOSITION_FPS,
    width: 1080,
    height: 1920,
  };
  const backend = llmBackend();

  if (backend === "mock") {
    const body = mockPlan(analysis, transcript);
    const raw: EditPlan = {
      schemaVersion: 1,
      language: transcript.language,
      provenance: { promptVersion: "mock-plan@1", model: "mock", schemaVersion: 1 },
      source,
      ...body,
    };
    writeJsonAtomic(projectFile(projectId, "editplan.raw.json"), raw);
    const { plan, notes } = lintAndSnap(applyPrefs(raw, prefs), transcript, probe.durationMs);
    if (notes.length) noteStage(projectId, "plan", `lint fixes: ${notes.length}`);
    const final = EditPlanSchema.parse(plan);
    writeJsonAtomic(projectFile(projectId, "editplan.json"), final);
    return final;
  }

  const prompt = loadPrompt("plan");
  const baseUser = [
    `Video duration: ${(probe.durationMs / 1000).toFixed(1)}s at ${COMPOSITION_FPS}fps, vertical 1080x1920.`,
    `Language: ${transcript.language}. Word count: ${transcript.words.length} (indices 0..${transcript.words.length - 1}).`,
    prefs.captions?.enabled === false
      ? "USER PREFERENCE: captions disabled."
      : prefs.captions?.position
        ? `USER PREFERENCE: captions at ${prefs.captions.position}.`
        : "",
    "",
    "CONTENT ANALYSIS:",
    JSON.stringify({ ...analysis, provenance: undefined, schemaVersion: undefined }),
    "",
    "INDEXED TRANSCRIPT:",
    indexedTranscript(transcript.words),
  ]
    .filter(Boolean)
    .join("\n");

  let errorFeedback = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await structuredCall({
        system: prompt.body,
        user: errorFeedback ? `${baseUser}\n\nYOUR PREVIOUS ATTEMPT FAILED:\n${errorFeedback}\nFix these issues and emit the full corrected plan.` : baseUser,
        toolName: "emit_edit_plan",
        toolDescription: "Emit the complete EditPlan for this video.",
        schema: LlmPlanSchema,
      });
      if (res.costUsd !== null) setStageCost(projectId, "plan", res.costUsd);
      const raw: EditPlan = {
        schemaVersion: 1,
        language: transcript.language,
        provenance: { promptVersion: prompt.version, model: llmModel(), schemaVersion: 1 },
        source,
        style: res.value.style,
        captions: res.value.captions,
        scenes: res.value.scenes.map((s) => ({ ...s, startMs: null, endMs: null })),
      };
      writeJsonAtomic(projectFile(projectId, "editplan.raw.json"), raw);
      const { plan, notes } = lintAndSnap(applyPrefs(raw, prefs), transcript, probe.durationMs);
      if (notes.length) noteStage(projectId, "plan", `lint fixes: ${notes.length}`);
      const final = EditPlanSchema.parse(plan);
      writeJsonAtomic(projectFile(projectId, "editplan.json"), final);
      return final;
    } catch (err) {
      errorFeedback = err instanceof Error ? err.message : String(err);
      if (attempt === 3) {
        noteStage(projectId, "plan", "captions-only fallback after 3 failed attempts");
        const fallback = applyPrefs(
          captionsOnlyPlan(transcript, source, prompt.version),
          prefs,
        );
        writeJsonAtomic(projectFile(projectId, "editplan.json"), fallback);
        return fallback;
      }
    }
  }
  throw new Error("unreachable");
};
