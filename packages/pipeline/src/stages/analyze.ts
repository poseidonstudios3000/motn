import { AnalysisSchema, type Analysis, type Transcript } from "@motn/schema";
import { projectFile, readJson, writeJsonAtomic } from "../paths";
import { llmBackend, llmModel } from "../env";
import { loadPrompt } from "../llm/prompts";
import { structuredCall, indexedTranscript } from "../llm/client";
import { setStageCost } from "../jobs";
import { mockAnalyze } from "./mock-analyze";

const LlmAnalysisSchema = AnalysisSchema.omit({ schemaVersion: true, provenance: true });

export const runAnalyze = async (projectId: string): Promise<Analysis> => {
  const transcript = readJson<Transcript>(projectFile(projectId, "transcript.json"));
  const backend = llmBackend();

  let analysis: Analysis;
  if (backend === "mock") {
    analysis = {
      schemaVersion: 1,
      provenance: { promptVersion: "mock-analyze@1", model: "mock", schemaVersion: 1 },
      ...mockAnalyze(transcript),
    };
  } else {
    const prompt = loadPrompt("analyze");
    const user = [
      `Language: ${transcript.language}`,
      `Word count: ${transcript.words.length} (indices 0..${transcript.words.length - 1})`,
      "",
      "INDEXED TRANSCRIPT:",
      indexedTranscript(transcript.words),
    ].join("\n");
    const res = await structuredCall({
      system: prompt.body,
      user,
      toolName: "emit_analysis",
      toolDescription: "Emit the structured content analysis of this transcript.",
      schema: LlmAnalysisSchema,
    });
    if (res.costUsd !== null) setStageCost(projectId, "analyze", res.costUsd);
    analysis = {
      schemaVersion: 1,
      provenance: { promptVersion: prompt.version, model: llmModel(), schemaVersion: 1 },
      ...res.value,
    };
  }

  writeJsonAtomic(projectFile(projectId, "analysis.json"), AnalysisSchema.parse(analysis));
  return analysis;
};
