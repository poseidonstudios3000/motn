import { z } from "zod";

// Vendor-agnostic transcript. Character timestamps and audio events are
// optional so the Groq/whisper path degrades gracefully (Scribe-only extras).

export const WordSchema = z.object({
  i: z.number().int().nonnegative(),
  text: z.string().min(1),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1).nullable(),
  chars: z
    .array(z.object({ c: z.string(), startMs: z.number().int(), endMs: z.number().int() }))
    .nullable(),
});
export type Word = z.infer<typeof WordSchema>;

export const TranscriptSegmentSchema = z.object({
  startWord: z.number().int().nonnegative(),
  endWord: z.number().int().nonnegative(),
  text: z.string(),
});

export const AudioEventSchema = z.object({
  type: z.enum(["laughter", "music", "applause", "other"]),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
});

export const TranscriptSchema = z.object({
  schemaVersion: z.literal(1),
  language: z.string().min(2), // BCP-47, auto-detected by the STT vendor
  provider: z.enum(["scribe-v2", "groq-whisper-v3-turbo", "mock"]),
  words: z.array(WordSchema),
  segments: z.array(TranscriptSegmentSchema),
  events: z.array(AudioEventSchema).nullable(),
});
export type Transcript = z.infer<typeof TranscriptSchema>;
