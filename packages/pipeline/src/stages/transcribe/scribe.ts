import fs from "node:fs";
import type { Transcript } from "@motn/schema";
import { segmentsFromWords } from "./adapter";

// ElevenLabs Scribe v2: word + character timestamps, 99-language auto-detect
// (incl. mid-file code-switching), audio event tags. Primary STT vendor.
export const transcribeScribe = async (audioFile: string): Promise<Transcript> => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set (or use MOTN_STT=groq|mock)");

  const form = new FormData();
  form.append("model_id", "scribe_v2");
  form.append("timestamps_granularity", "character");
  form.append("tag_audio_events", "true");
  form.append("diarize", "false");
  form.append(
    "file",
    new Blob([fs.readFileSync(audioFile)], { type: "audio/flac" }),
    "audio.flac",
  );

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Scribe API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    language_code?: string;
    words?: Array<{
      text: string;
      start: number;
      end: number;
      type?: string; // "word" | "spacing" | "audio_event"
      logprob?: number;
      characters?: Array<{ text: string; start: number; end: number }> | null;
    }>;
  };

  const words: Transcript["words"] = [];
  const events: NonNullable<Transcript["events"]> = [];
  for (const w of data.words ?? []) {
    if (w.type === "audio_event") {
      const label = w.text.replace(/[()]/g, "").trim().toLowerCase();
      events.push({
        type: label.includes("laugh") ? "laughter"
          : label.includes("music") ? "music"
          : label.includes("applause") ? "applause"
          : "other",
        startMs: Math.round(w.start * 1000),
        endMs: Math.round(w.end * 1000),
      });
      continue;
    }
    if (w.type === "spacing") continue;
    const text = w.text.trim();
    if (!text) continue;
    words.push({
      i: words.length,
      text,
      startMs: Math.round(w.start * 1000),
      endMs: Math.round(w.end * 1000),
      confidence: w.logprob !== undefined ? Math.min(1, Math.exp(w.logprob)) : null,
      chars:
        w.characters?.map((c) => ({
          c: c.text,
          startMs: Math.round(c.start * 1000),
          endMs: Math.round(c.end * 1000),
        })) ?? null,
    });
  }

  return {
    schemaVersion: 1,
    language: data.language_code ?? "en",
    provider: "scribe-v2",
    words,
    segments: segmentsFromWords(words),
    events: events.length ? events : null,
  };
};
