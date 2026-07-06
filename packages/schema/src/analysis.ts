import { z } from "zod";
import { ProvenanceSchema } from "./provenance";

// Claude pass 1 output: what the video is about and where its structure
// lives, all timed by WORD INDICES — never seconds. A deterministic
// post-processor owns index→ms conversion.

export const WordRangeSchema = z.object({
  startWord: z.number().int().nonnegative(),
  endWord: z.number().int().nonnegative(),
});

export const AnalysisSchema = z.object({
  schemaVersion: z.literal(1),
  provenance: ProvenanceSchema,
  topic: z.string(),
  tone: z.enum(["energetic", "conversational", "serious", "playful", "authoritative"]),
  contentType: z.enum(["explainer", "listicle", "story", "opinion", "tutorial", "promo"]),
  hook: WordRangeSchema.extend({ text: z.string() }).nullable(),
  outline: z.array(WordRangeSchema.extend({ label: z.string() })),
  claims: z.array(WordRangeSchema.extend({ text: z.string() })),
  stats: z.array(
    z.object({
      value: z.number(),
      prefix: z.string().nullable(), // e.g. "$"
      suffix: z.string().nullable(), // e.g. "%"
      label: z.string(),
      wordIndex: z.number().int().nonnegative(),
    }),
  ),
  lists: z.array(
    WordRangeSchema.extend({
      title: z.string().nullable(),
      items: z.array(z.object({ text: z.string(), wordIndex: z.number().int().nonnegative() })),
    }),
  ),
  emphasisCandidates: z.array(z.number().int().nonnegative()),
});
export type Analysis = z.infer<typeof AnalysisSchema>;
