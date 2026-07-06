import { TranscriptSchema, type Transcript } from "@motn/schema";
import { projectFile, writeJsonAtomic } from "../../paths";
import { sttBackend } from "../../env";
import { transcribeScribe } from "./scribe";
import { transcribeGroq } from "./groq";
import { transcribeMock } from "./mock";

export const runTranscribe = async (projectId: string): Promise<Transcript> => {
  const audio = projectFile(projectId, "audio.flac");
  const backend = sttBackend();
  const raw =
    backend === "scribe"
      ? await transcribeScribe(audio)
      : backend === "groq"
        ? await transcribeGroq(audio)
        : await transcribeMock(projectId);
  const transcript = TranscriptSchema.parse(raw);
  if (transcript.words.length < 5) {
    throw new Error("Transcript has fewer than 5 words — is there speech in this video?");
  }
  writeJsonAtomic(projectFile(projectId, "transcript.json"), transcript);
  return transcript;
};

// Build sentence-ish segments from words when the vendor doesn't give us any.
export const segmentsFromWords = (
  words: Transcript["words"],
): Transcript["segments"] => {
  const segments: Transcript["segments"] = [];
  let start = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const isEnd = /[.!?]$/.test(w.text) || i === words.length - 1;
    const nextGap = i + 1 < words.length ? words[i + 1]!.startMs - w.endMs : 0;
    if (isEnd || nextGap > 900) {
      segments.push({
        startWord: start,
        endWord: i,
        text: words.slice(start, i + 1).map((x) => x.text).join(" "),
      });
      start = i + 1;
    }
  }
  return segments;
};
