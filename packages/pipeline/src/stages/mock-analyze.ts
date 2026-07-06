import type { Analysis, Transcript } from "@motn/schema";

// Deterministic heuristic analysis for keyless dev/demo runs. Doubles as the
// zero-cost draft mode: crude but structurally identical to the LLM output.

const STOPWORDS = new Set(
  "the a an and or but so of to in on for with at by from that this these those is are was were be been being you your yours i we they he she it its my our their do does did will would can could should have has had not no yes if then than as about into after before every almost".split(
    " ",
  ),
);

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000, million: 1e6,
};

const clean = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}$%]/gu, "");

type Mock = Omit<Analysis, "schemaVersion" | "provenance">;

export const mockAnalyze = (transcript: Transcript): Mock => {
  const words = transcript.words;
  const texts = words.map((w) => clean(w.text));

  // --- stats: digit numbers and composed number-words ---
  const stats: Mock["stats"] = [];
  for (let i = 0; i < texts.length && stats.length < 4; i++) {
    const t = texts[i]!;
    let value: number | null = null;
    let span = 1;
    const digit = t.match(/^\$?(\d+(?:\.\d+)?)%?$/);
    if (digit) value = Number(digit[1]);
    else if (NUMBER_WORDS[t] !== undefined && NUMBER_WORDS[t]! < 100) {
      value = NUMBER_WORDS[t]!;
      const next = NUMBER_WORDS[texts[i + 1] ?? ""];
      if (next !== undefined && next >= 100) {
        value *= next;
        span = 2;
      }
    }
    if (value === null) continue;
    const after = texts[i + span] ?? "";
    const suffix = t.includes("%") || after === "percent" ? "%" : null;
    const prefix = t.startsWith("$") ? "$" : null;
    // Only meaningful magnitudes — skip "one thing" style filler.
    if (value < 10 && !suffix && !prefix) continue;
    const labelStart = i + span + (suffix && after === "percent" ? 1 : 0);
    const labelWords: string[] = [];
    for (const w of words.slice(labelStart, labelStart + 5)) {
      labelWords.push(w.text.replace(/[.!?,;:]+$/, ""));
      if (/[.!?]$/.test(w.text)) break; // never cross a sentence boundary
    }
    stats.push({ value, prefix, suffix, label: labelWords.join(" ").slice(0, 48), wordIndex: i });
    i += span;
  }

  // --- lists: ordinal sentence openers ---
  const ORDINALS = ["first", "second", "third", "fourth", "fifth"];
  const items: Mock["lists"][number]["items"] = [];
  for (const seg of transcript.segments) {
    const opener = texts[seg.startWord] ?? "";
    if (ORDINALS.includes(opener)) {
      const itemText = words
        .slice(seg.startWord + 1, Math.min(seg.startWord + 9, seg.endWord + 1))
        .map((w) => w.text)
        .join(" ")
        .replace(/^[,\s]+/, "")
        .replace(/[.!?,;:]+$/, "");
      items.push({ text: itemText.slice(0, 60), wordIndex: seg.startWord });
    }
  }
  const lists: Mock["lists"] =
    items.length >= 2
      ? [{
          startWord: items[0]!.wordIndex,
          endWord: Math.min(
            words.length - 1,
            (transcript.segments.find((s) => s.startWord === items.at(-1)!.wordIndex)?.endWord ??
              words.length - 1),
          ),
          title: null,
          items,
        }]
      : [];

  // --- hook: the first sentence, if it lands inside the first 15% ---
  const firstSeg = transcript.segments[0];
  const hook =
    firstSeg && firstSeg.endWord <= Math.max(10, words.length * 0.15)
      ? {
          startWord: firstSeg.startWord,
          endWord: firstSeg.endWord,
          text: firstSeg.text,
        }
      : null;

  // --- outline: segments grouped into ~18s+ beats ---
  const outline: Mock["outline"] = [];
  let beatStart = 0;
  let beatStartMs = words[0]?.startMs ?? 0;
  for (let s = 0; s < transcript.segments.length; s++) {
    const seg = transcript.segments[s]!;
    const endMs = words[seg.endWord]?.endMs ?? 0;
    const isLast = s === transcript.segments.length - 1;
    if (endMs - beatStartMs >= 18000 || isLast) {
      const startWord = transcript.segments[beatStart]!.startWord;
      outline.push({
        startWord,
        endWord: seg.endWord,
        label: words.slice(startWord, startWord + 4).map((w) => w.text).join(" "),
      });
      beatStart = s + 1;
      beatStartMs = endMs;
    }
  }
  if (outline.length === 0 && words.length > 0) {
    outline.push({ startWord: 0, endWord: words.length - 1, label: "Full video" });
  }

  // --- claims: markers of quotable statements ---
  const MARKERS = /\b(because|nobody|truth|secret|most people|the game|simple|everyone)\b/i;
  const claims: Mock["claims"] = transcript.segments
    .filter((s) => MARKERS.test(s.text) && s.endWord - s.startWord >= 5)
    .slice(0, 3)
    .map((s) => ({ startWord: s.startWord, endWord: s.endWord, text: s.text }));

  // --- emphasis candidates: scored, spaced ---
  const scored = words
    .map((w, i) => {
      const t = texts[i]!;
      if (!t || STOPWORDS.has(t)) return { i, score: 0 };
      let score = 0;
      if (/\d/.test(t) || NUMBER_WORDS[t] !== undefined) score += 3;
      if (t.length >= 7) score += 2;
      else if (t.length >= 5) score += 1;
      return { i, score };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score);
  const emphasisCandidates: number[] = [];
  const budget = Math.max(3, Math.floor(words.length * 0.06));
  for (const { i } of scored) {
    if (emphasisCandidates.length >= budget) break;
    if (emphasisCandidates.every((e) => Math.abs(e - i) >= 4)) emphasisCandidates.push(i);
  }
  emphasisCandidates.sort((a, b) => a - b);

  const exclaims = transcript.segments.filter((s) => s.text.endsWith("!")).length;
  return {
    topic: transcript.segments[0]?.text.slice(0, 80) ?? "Talking head video",
    tone: exclaims / Math.max(1, transcript.segments.length) > 0.15 ? "energetic" : "conversational",
    contentType: lists.length > 0 ? "listicle" : "explainer",
    hook,
    outline,
    claims,
    stats,
    lists,
    emphasisCandidates,
  };
};
