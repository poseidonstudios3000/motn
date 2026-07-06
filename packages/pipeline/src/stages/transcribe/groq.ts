import fs from "node:fs";
import type { Transcript } from "@motn/schema";
import { segmentsFromWords } from "./adapter";

// Groq-hosted whisper-large-v3-turbo: ~220x realtime, ~$0.04/hr. The fast/
// cheap draft mode and vendor-outage fallback. OpenAI-compatible API.
export const transcribeGroq = async (audioFile: string): Promise<Transcript> => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set (or use MOTN_STT=scribe|mock)");

  const form = new FormData();
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("timestamp_granularities[]", "segment");
  form.append(
    "file",
    new Blob([fs.readFileSync(audioFile)], { type: "audio/flac" }),
    "audio.flac",
  );

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Groq API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    language?: string;
    words?: Array<{ word: string; start: number; end: number }>;
  };

  const words: Transcript["words"] = (data.words ?? [])
    .map((w) => w.word.trim())
    .map((text, idx) => {
      const w = data.words![idx]!;
      return {
        i: idx,
        text,
        startMs: Math.round(w.start * 1000),
        endMs: Math.round(w.end * 1000),
        confidence: null,
        chars: null,
      };
    })
    .filter((w) => w.text.length > 0)
    .map((w, idx) => ({ ...w, i: idx }));

  return {
    schemaVersion: 1,
    language: data.language ?? "en",
    provider: "groq-whisper-v3-turbo",
    words,
    segments: segmentsFromWords(words),
    events: null,
  };
};
