import fs from "node:fs";
import type { Transcript } from "@motn/schema";
import { projectFile, readJson } from "../../paths";
import { segmentsFromWords } from "./adapter";
import { detectSpeechRuns } from "../../media";
import type { IngestOutput } from "../ingest";

const FALLBACK_SCRIPT = `Here is the thing nobody tells you about making videos. Most people quit after their first ten uploads. But the data says something wild: 87 percent of channels that post one hundred videos cross one thousand subscribers. So the game is simple. First, pick one topic you can talk about forever. Second, publish on a schedule you can actually keep. Third, study your retention graph every single week. Do that for one year and you will beat almost everyone, because almost everyone quits.`;

// Keyless transcriber for dev, CI, and no-STT-key runs. Uses the project's
// source.script.txt (what the speaker actually said) if present, else a
// built-in script. Timing is NOT uniform: sentences are packed into the
// speaker's real speech runs (ffmpeg silencedetect), so scene cuts and
// caption pages land on genuine pauses. Real vendor STT is still strictly
// better (exact word timestamps) — this is the best keyless approximation.

const wordWeight = (t: string) => {
  const clean = t.replace(/[^\p{L}\p{N}]/gu, "");
  let w = 180 + clean.length * 42;
  if (/[.!?]$/.test(t)) w += 120;
  else if (/[,;:]$/.test(t)) w += 60;
  return w;
};

export const transcribeMock = async (projectId: string): Promise<Transcript> => {
  const scriptFile = projectFile(projectId, "source.script.txt");
  const text = fs.existsSync(scriptFile)
    ? fs.readFileSync(scriptFile, "utf8").replace(/\s+/g, " ").trim()
    : FALLBACK_SCRIPT;
  const probe = readJson<IngestOutput>(projectFile(projectId, "probe.json"));
  const runs = await detectSpeechRuns(projectFile(projectId, "audio.flac"), probe.durationMs);

  // Sentences with their word tokens and relative weights.
  const sentences = (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text]).map((s) => {
    const tokens = s.trim().split(" ").filter(Boolean);
    return { tokens, weight: tokens.reduce((a, t) => a + wordWeight(t), 0) };
  });
  const totalWeight = sentences.reduce((a, s) => a + s.weight, 0);
  const totalSpeechMs = runs.reduce((a, r) => a + (r.endMs - r.startMs), 0);

  // Greedy linear partition: walk sentences into runs so each run's share of
  // speech time gets a matching share of script weight.
  const perRun: (typeof sentences)[] = runs.map(() => []);
  let runIdx = 0;
  let usedInRun = 0;
  for (const sentence of sentences) {
    const runBudget =
      ((runs[runIdx]!.endMs - runs[runIdx]!.startMs) / totalSpeechMs) * totalWeight;
    if (usedInRun > 0 && usedInRun + sentence.weight * 0.5 > runBudget && runIdx < runs.length - 1) {
      runIdx++;
      usedInRun = 0;
    }
    perRun[runIdx]!.push(sentence);
    usedInRun += sentence.weight;
  }

  // Lay words out inside each run proportionally to their weights.
  const words: Transcript["words"] = [];
  for (let r = 0; r < runs.length; r++) {
    const bucket = perRun[r]!;
    if (bucket.length === 0) continue;
    const run = runs[r]!;
    const runMs = run.endMs - run.startMs;
    const bucketWeight = bucket.reduce((a, s) => a + s.weight, 0);
    let cursor = run.startMs;
    for (const sentence of bucket) {
      for (const token of sentence.tokens) {
        const dur = (wordWeight(token) / bucketWeight) * runMs;
        words.push({
          i: words.length,
          text: token,
          startMs: Math.round(cursor),
          endMs: Math.round(cursor + dur * 0.88),
          confidence: 0.5, // flagged: aligned, not recognized
          chars: null,
        });
        cursor += dur;
      }
    }
  }

  return {
    schemaVersion: 1,
    language: "en",
    provider: "mock",
    words,
    segments: segmentsFromWords(words),
    events: null,
  };
};
