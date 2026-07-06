import "./env";
import { STAGES, type StageName } from "@motn/schema";
import { projectFile } from "./paths";
import { inputsHash, isFresh, writeStamp } from "./cache";
import { stageWrap, updateStage } from "./jobs";
import { sttBackend, llmBackend, llmModel } from "./env";
import { loadPrompt } from "./llm/prompts";
import { runIngest } from "./stages/ingest";
import { runTranscribe } from "./stages/transcribe/adapter";
import { runAnalyze } from "./stages/analyze";
import { runPlan } from "./stages/plan";
import { runResolve } from "./stages/resolve";
import type { Resolution } from "./stages/render";

export type RunOptions = { resolution?: Resolution; force?: boolean };

type StageDef = {
  inputs: (projectId: string) => string[];
  extra: () => string[];
  outputs: (projectId: string) => string[];
  run: (projectId: string, opts: RunOptions) => Promise<unknown>;
};

const p = projectFile;

const DEFS: Record<StageName, StageDef> = {
  ingest: {
    inputs: (id) => [p(id, "source.mp4")],
    extra: () => [],
    outputs: (id) => [p(id, "probe.json"), p(id, "proxy.mp4"), p(id, "audio.flac")],
    run: (id) => runIngest(id),
  },
  transcribe: {
    inputs: (id) => [p(id, "audio.flac"), p(id, "source.script.txt")],
    extra: () => [sttBackend()],
    outputs: (id) => [p(id, "transcript.json")],
    run: (id) => runTranscribe(id),
  },
  analyze: {
    inputs: (id) => [p(id, "transcript.json")],
    extra: () => [
      llmBackend(),
      llmBackend() === "anthropic" ? `${llmModel()}:${loadPrompt("analyze").version}` : "mock",
    ],
    outputs: (id) => [p(id, "analysis.json")],
    run: (id) => runAnalyze(id),
  },
  plan: {
    inputs: (id) => [p(id, "analysis.json"), p(id, "transcript.json"), p(id, "prefs.json")],
    extra: () => [
      llmBackend(),
      llmBackend() === "anthropic" ? `${llmModel()}:${loadPrompt("plan").version}` : "mock",
    ],
    outputs: (id) => [p(id, "editplan.json")],
    run: (id) => runPlan(id),
  },
  resolve: {
    inputs: (id) => [p(id, "editplan.json"), p(id, "transcript.json")],
    extra: () => [],
    outputs: (id) => [p(id, "resolved.json")],
    run: (id) => runResolve(id),
  },
  render: {
    inputs: (id) => [p(id, "resolved.json")],
    extra: () => [],
    outputs: () => [], // per-resolution output handled below
    // Lazy: @remotion/bundler drags in native binaries — only load it when a
    // render actually runs, never at module import.
    run: async (id, opts) => {
      const { runRender } = await import("./stages/render");
      return runRender(id, opts.resolution ?? "1080p");
    },
  },
};

export const runStage = async (
  projectId: string,
  stage: StageName,
  opts: RunOptions = {},
): Promise<void> => {
  const def = DEFS[stage];
  const extra = [...def.extra()];
  if (stage === "render") extra.push(opts.resolution ?? "1080p");
  const hash = inputsHash(stage, def.inputs(projectId), extra);
  const outputs =
    stage === "render"
      ? [p(projectId, `renders/final-${opts.resolution ?? "1080p"}.mp4`)]
      : def.outputs(projectId);
  if (!opts.force && isFresh(projectId, stage, hash, outputs)) {
    updateStage(projectId, stage, { status: "done", note: "cache hit" });
    return;
  }
  await stageWrap(projectId, stage, () => def.run(projectId, opts));
  writeStamp(projectId, stage, hash);
};

export const runAll = async (projectId: string, opts: RunOptions = {}): Promise<void> => {
  for (const stage of STAGES) {
    await runStage(projectId, stage, opts);
  }
};

// Everything up to (not including) render — what the web UI kicks off on
// upload so the user lands on a scrubbing preview, then renders on demand.
export const runToPreview = async (projectId: string, opts: RunOptions = {}): Promise<void> => {
  for (const stage of STAGES.filter((s) => s !== "render")) {
    await runStage(projectId, stage, opts);
  }
};
