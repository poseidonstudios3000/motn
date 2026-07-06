import type { Analysis, EditPlan, Scene, Transcript } from "@motn/schema";

// Deterministic heuristic planner for keyless dev/demo runs and as the
// zero-cost draft mode. Produces the same shapes the LLM would; everything
// still passes through lintAndSnap afterwards.

type PlanBody = Pick<EditPlan, "style" | "captions" | "scenes">;

const EMOJI_DICT: Array<[RegExp, string]> = [
  [/\b(money|dollar|price|revenue|paid?)\b/i, "💰"],
  [/\b(grow|growth|increase|cross|beat)\b/i, "📈"],
  [/\b(data|graph|retention|number)\b/i, "📊"],
  [/\b(year|week|schedule|daily)\b/i, "📅"],
  [/\b(wild|fire|crazy|insane)\b/i, "🔥"],
];

// Country detection for the semantic components. Multi-word aliases matched
// as bigrams; short codes ("US") matched case-sensitively so the pronoun
// "us" never becomes a map.
const COUNTRIES: Array<{
  code: string;
  name: string;
  label: string;
  aliases: Array<{ t: string; cased?: boolean }>;
}> = [
  {
    code: "us",
    name: "United States",
    label: "USA",
    aliases: [{ t: "united states" }, { t: "america" }, { t: "usa" }, { t: "US", cased: true }],
  },
  { code: "cn", name: "China", label: "China", aliases: [{ t: "china" }] },
  {
    code: "gb",
    name: "United Kingdom",
    label: "UK",
    aliases: [{ t: "united kingdom" }, { t: "britain" }, { t: "UK", cased: true }],
  },
  { code: "in", name: "India", label: "India", aliases: [{ t: "india" }] },
  { code: "jp", name: "Japan", label: "Japan", aliases: [{ t: "japan" }] },
  { code: "de", name: "Germany", label: "Germany", aliases: [{ t: "germany" }] },
  { code: "fr", name: "France", label: "France", aliases: [{ t: "france" }] },
  { code: "kr", name: "South Korea", label: "Korea", aliases: [{ t: "south korea" }, { t: "korea" }] },
  { code: "tw", name: "Taiwan", label: "Taiwan", aliases: [{ t: "taiwan" }] },
];

type CountryMention = { code: string; name: string; label: string; wordIndex: number };

const countryMentions = (transcript: Transcript, start: number, end: number): CountryMention[] => {
  const out: CountryMention[] = [];
  for (let i = start; i <= end; i++) {
    const raw = transcript.words[i]!.text.replace(/[^\p{L}.]/gu, "");
    const lower = raw.toLowerCase().replace(/\./g, "");
    const next = i < end ? transcript.words[i + 1]!.text.replace(/[^\p{L}]/gu, "").toLowerCase() : "";
    const bigram = `${lower} ${next}`;
    for (const c of COUNTRIES) {
      const hit = c.aliases.some((a) =>
        a.cased ? raw.replace(/\./g, "") === a.t : a.t === lower || a.t === bigram,
      );
      if (hit && !out.some((m) => m.code === c.code)) {
        out.push({ code: c.code, name: c.name, label: c.label, wordIndex: i });
      }
    }
  }
  return out;
};

const sentenceRangeAround = (
  transcript: Transcript,
  wordIndex: number,
): { start: number; end: number } => {
  const seg = transcript.segments.find(
    (s) => wordIndex >= s.startWord && wordIndex <= s.endWord,
  );
  return seg
    ? { start: seg.startWord, end: seg.endWord }
    : { start: Math.max(0, wordIndex - 6), end: Math.min(transcript.words.length - 1, wordIndex + 6) };
};

export const mockPlan = (analysis: Analysis, transcript: Transcript): PlanBody => {
  const lastWord = transcript.words.length - 1;
  const scenes: Scene[] = [];
  let sceneN = 0;
  const nid = () => `s${++sceneN}`;

  type Marked = { start: number; end: number; scene: Omit<Scene, "id" | "startWordIndex" | "endWordIndex" | "startMs" | "endMs"> };
  const marked: Marked[] = [];

  // Hook: opening title card over the speaker, punch-in.
  if (analysis.hook) {
    const title = analysis.hook.text
      .split(" ")
      .slice(0, 6)
      .join(" ")
      .replace(/[.!?,]+$/, "");
    marked.push({
      start: analysis.hook.startWord,
      end: analysis.hook.endWord,
      scene: {
        layout: "talking-head-full",
        splitConfig: null,
        talkingHead: { zoom: "punch-in" },
        transitionIn: "cut",
        graphic: {
          component: "hookTitle",
          props: { title: title.slice(0, 60), subtitle: null },
          assets: [],
          enter: "pop",
          exit: "fade",
        },
        rationale: "hook: open on the strongest claim",
      },
    });
  }

  // Semantic depiction: matchup sentences become versus; single-country
  // beats become geoMap zooms (extended through pronoun follow-ons).
  const segs = transcript.segments;
  for (let s = 0; s < segs.length; s++) {
    const seg = segs[s]!;
    const mentions = countryMentions(transcript, seg.startWord, seg.endWord);
    const isMatchup = mentions.length >= 2 && /\b(or|vs|versus|against)\b/i.test(seg.text);
    if (isMatchup) {
      const [a, b] = mentions;
      // A matchup question is usually short — let the card breathe into the
      // following sentence so the VS moment isn't cut off mid-slam.
      const shortQuestion = seg.endWord - seg.startWord < 10;
      const end =
        shortQuestion && s + 1 < segs.length ? segs[s + 1]!.endWord : seg.endWord;
      if (shortQuestion) s++;
      marked.push({
        start: seg.startWord,
        end,
        scene: {
          layout: "animation-full",
          splitConfig: null,
          talkingHead: null,
          transitionIn: "fade",
          graphic: {
            component: "versus",
            props: {
              left: { label: a!.label, assetIndex: 0, triggerWordIndex: a!.wordIndex },
              right: { label: b!.label, assetIndex: 1, triggerWordIndex: b!.wordIndex },
            },
            assets: [
              { kind: "flag", query: a!.code, resolvedName: null, resolvedSvg: null },
              { kind: "flag", query: b!.code, resolvedName: null, resolvedSvg: null },
            ],
            enter: "pop",
            exit: "fade",
          },
          rationale: "matchup framing — show the two contenders",
        },
      });
      continue;
    }
    if (mentions.length === 1) {
      const m = mentions[0]!;
      // Extend the map beat while following sentences stay on-subject.
      let end = seg.endWord;
      let k = s;
      while (
        k + 1 < segs.length &&
        /^(it|its|they|their|that)\b/i.test(segs[k + 1]!.text)
      ) {
        k++;
        end = segs[k]!.endWord;
      }
      marked.push({
        start: seg.startWord,
        end,
        scene: {
          layout: "split",
          splitConfig: { side: "top", ratio: 0.42 },
          talkingHead: { zoom: "none" },
          transitionIn: "slide",
          graphic: {
            component: "geoMap",
            props: {
              country: m.name,
              label: m.label,
              flagAssetIndex: 0,
              triggerWordIndex: m.wordIndex,
            },
            assets: [{ kind: "flag", query: m.code, resolvedName: null, resolvedSvg: null }],
            enter: "fade",
            exit: "fade",
          },
          rationale: `country beat — zoom the map to ${m.name}`,
        },
      });
      s = k;
    }
  }

  // Stats: split-screen count-ups.
  for (const st of analysis.stats) {
    const r = sentenceRangeAround(transcript, st.wordIndex);
    marked.push({
      start: r.start,
      end: r.end,
      scene: {
        layout: "split",
        splitConfig: { side: "top", ratio: 0.45 },
        talkingHead: { zoom: "none" },
        transitionIn: "slide",
        graphic: {
          component: "statCounter",
          props: {
            value: st.value,
            prefix: st.prefix,
            suffix: st.suffix,
            label: st.label.slice(0, 64),
            triggerWordIndex: st.wordIndex,
          },
          assets: [],
          enter: "pop",
          exit: "fade",
        },
        rationale: "stat moment — count-up reinforces the number",
      },
    });
  }

  // Lists: reveal builds, item-by-item as the speaker reaches them.
  for (const list of analysis.lists) {
    marked.push({
      start: list.startWord,
      end: list.endWord,
      scene: {
        layout: "split",
        splitConfig: { side: "top", ratio: 0.42 },
        talkingHead: { zoom: "none" },
        transitionIn: "slide",
        graphic: {
          component: "listReveal",
          props: {
            title: list.title,
            items: list.items.slice(0, 5).map((it) => ({
              text: it.text.slice(0, 60),
              triggerWordIndex: it.wordIndex,
            })),
          },
          assets: [],
          enter: "slide-up",
          exit: "fade",
        },
        rationale: "enumeration — build the list as it is spoken",
      },
    });
  }

  // Strongest claim: full-screen quote card.
  const claim = analysis.claims[0];
  if (claim) {
    marked.push({
      start: claim.startWord,
      end: claim.endWord,
      scene: {
        layout: "animation-full",
        splitConfig: null,
        talkingHead: null,
        transitionIn: "fade",
        graphic: {
          component: "quoteCard",
          props: { quote: claim.text.slice(0, 160), attribution: null, triggerWordIndex: claim.startWord },
          assets: [],
          enter: "fade",
          exit: "fade",
        },
        rationale: "quotable claim — let it stand alone",
      },
    });
  }

  // One kinetic text punch from the middle of the video.
  const mid = analysis.emphasisCandidates.find((i) => i > lastWord * 0.4 && i < lastWord * 0.8);
  if (mid !== undefined) {
    const r = sentenceRangeAround(transcript, mid);
    const text = transcript.words
      .slice(mid, Math.min(mid + 4, r.end + 1))
      .map((w) => w.text)
      .join(" ")
      .replace(/[.!?,]+$/, "");
    marked.push({
      start: r.start,
      end: r.end,
      scene: {
        layout: "talking-head-full",
        splitConfig: null,
        talkingHead: { zoom: "slow-in" },
        transitionIn: "cut",
        graphic: {
          component: "kineticText",
          props: { text: text.slice(0, 48), triggerWordIndex: mid },
          assets: [],
          enter: "pop",
          exit: "fade",
        },
        rationale: "kinetic punch on an emphasis phrase",
      },
    });
  }

  // Resolve overlaps between marked scenes (first one wins), then emit in
  // order. Gaps are left for lintAndSnap to fill with plain talking head.
  marked.sort((a, b) => a.start - b.start);
  let cursor = 0;
  for (const m of marked) {
    const start = Math.max(m.start, cursor);
    if (m.end < start) continue;
    scenes.push({
      id: nid(),
      startWordIndex: start,
      endWordIndex: m.end,
      startMs: null,
      endMs: null,
      ...m.scene,
    });
    cursor = m.end + 1;
  }

  // Captions: on by default, style follows tone.
  const punchy = analysis.tone === "energetic" || analysis.tone === "playful";
  const emojiInserts: PlanBody["captions"]["emojiInserts"] = [];
  for (const i of analysis.emphasisCandidates) {
    const w = transcript.words[i];
    if (!w) continue;
    const hit = EMOJI_DICT.find(([re]) => re.test(w.text));
    if (hit && emojiInserts.length < 3) emojiInserts.push({ afterWordIndex: i, emoji: hit[1] });
  }

  return {
    style: { theme: "editorial-dark", motionIntensity: punchy ? "punchy" : "subtle" },
    captions: {
      enabled: true,
      position: "bottom",
      preset: punchy ? "punchy" : "editorial",
      emphases: analysis.emphasisCandidates.map((wordIndex, k) => ({
        wordIndex,
        effect: k % 3 === 2 ? "scale" : "color",
      })),
      emojiInserts,
    },
    scenes,
  };
};
