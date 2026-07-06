import fs from "node:fs";
import type { Transcript } from "@motn/schema";
import { projectFile, readJson } from "../../paths";
import { segmentsFromWords } from "./adapter";
import type { IngestOutput } from "../ingest";

const FALLBACK_SCRIPT = `Here is the thing nobody tells you about making videos. Most people quit after their first ten uploads. But the data says something wild: 87 percent of channels that post one hundred videos cross one thousand subscribers. So the game is simple. First, pick one topic you can talk about forever. Second, publish on a schedule you can actually keep. Third, study your retention graph every single week. Do that for one year and you will beat almost everyone, because almost everyone quits.`;

// Deterministic offline transcriber for dev, CI, and keyless demo runs.
// Uses <project>/source.script.txt if present, else a built-in script, and
// spaces the words across the real media duration with punctuation pauses.
export const transcribeMock = async (projectId: string): Promise<Transcript> => {
  const scriptFile = projectFile(projectId, "source.script.txt");
  const text = fs.existsSync(scriptFile)
    ? fs.readFileSync(scriptFile, "utf8").replace(/\s+/g, " ").trim()
    : FALLBACK_SCRIPT;
  const probe = readJson<IngestOutput>(projectFile(projectId, "probe.json"));

  const tokens = text.split(" ").filter(Boolean);
  // Weight: word length ≈ speaking time; punctuation adds a pause after.
  const weights = tokens.map((t) => {
    const clean = t.replace(/[^\p{L}\p{N}]/gu, "");
    let w = 180 + clean.length * 42;
    if (/[.!?]$/.test(t)) w += 380;
    else if (/[,;:]$/.test(t)) w += 180;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  // Leave a little lead-in and tail so captions never clip the media edges.
  const speakable = probe.durationMs * 0.94;
  const scale = speakable / total;

  const words: Transcript["words"] = [];
  let cursor = probe.durationMs * 0.03;
  for (let i = 0; i < tokens.length; i++) {
    const dur = weights[i]! * scale;
    const gap = /[.!?,;:]$/.test(tokens[i]!) ? dur * 0.35 : dur * 0.12;
    words.push({
      i,
      text: tokens[i]!,
      startMs: Math.round(cursor),
      endMs: Math.round(cursor + dur - gap),
      confidence: 1,
      chars: null,
    });
    cursor += dur;
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
