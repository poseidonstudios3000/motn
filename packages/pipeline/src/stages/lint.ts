import type { EditPlan, Scene, Transcript } from "@motn/schema";

// Deterministic lint + auto-fix + time-snapping. The LLM speaks in word
// indices; this stage owns every millisecond. Auto-fixes what it can and
// reports what it changed; only structurally hopeless plans are rejected
// (callers then retry the LLM or fall back to captions-only).

const FPS = 30;
const MIN_SCENE_WORDS = 3;
const MAX_PLAIN_SCENE_WORDS = 26; // ~8s at normal pace
const MIN_SCENE_FRAMES = 24; // 0.8s — below this a cut reads as a glitch
const EMPHASIS_RATIO = 0.08;

export type LintResult = {
  plan: EditPlan;
  notes: string[];
};

const chopRange = (
  start: number,
  end: number,
  idBase: string,
  zoomSeed: number,
): Scene[] => {
  const scenes: Scene[] = [];
  const total = end - start + 1;
  const parts = Math.max(1, Math.ceil(total / MAX_PLAIN_SCENE_WORDS));
  const per = Math.ceil(total / parts);
  const ZOOMS = ["none", "slow-in", "none", "punch-in"] as const;
  for (let p = 0; p < parts; p++) {
    const s = start + p * per;
    const e = Math.min(end, s + per - 1);
    if (s > e) break;
    scenes.push({
      id: `${idBase}-f${p}`,
      startWordIndex: s,
      endWordIndex: e,
      startMs: null,
      endMs: null,
      layout: "talking-head-full",
      splitConfig: null,
      talkingHead: { zoom: ZOOMS[(zoomSeed + p) % ZOOMS.length]! },
      transitionIn: "cut",
      graphic: null,
      rationale: "filler: continuous talking head",
    });
  }
  return scenes;
};

export const lintAndSnap = (
  plan: EditPlan,
  transcript: Transcript,
  durationMs: number,
): LintResult => {
  const notes: string[] = [];
  const lastWord = transcript.words.length - 1;
  const clampW = (i: number) => Math.max(0, Math.min(lastWord, Math.round(i)));

  // 1. Normalize scene indices, drop hopeless scenes, sort.
  let scenes = plan.scenes
    .map((sc) => ({
      ...sc,
      startWordIndex: clampW(sc.startWordIndex),
      endWordIndex: clampW(sc.endWordIndex),
    }))
    .filter((sc) => {
      if (sc.endWordIndex < sc.startWordIndex) {
        notes.push(`dropped scene ${sc.id}: inverted range`);
        return false;
      }
      return true;
    })
    .sort((a, b) => a.startWordIndex - b.startWordIndex);

  // 2. Enforce ordering + full coverage: clip overlaps, fill gaps.
  const covered: Scene[] = [];
  let cursor = 0;
  for (const sc of scenes) {
    let s = sc.startWordIndex;
    const e = sc.endWordIndex;
    if (s > cursor) {
      covered.push(...chopRange(cursor, s - 1, `gap${cursor}`, covered.length));
      notes.push(`filled word gap ${cursor}..${s - 1}`);
    }
    if (s < cursor) {
      s = cursor;
      notes.push(`clipped overlap on scene ${sc.id}`);
    }
    if (e < s) continue; // fully swallowed by previous scene
    covered.push({ ...sc, startWordIndex: s, endWordIndex: e });
    cursor = e + 1;
  }
  if (cursor <= lastWord) {
    covered.push(...chopRange(cursor, lastWord, `tail${cursor}`, covered.length));
    if (covered.length && cursor > 0) notes.push(`extended coverage to last word`);
  }
  scenes = covered;

  // 3. Merge too-short plain scenes into a neighbor; chop over-long plain ones.
  const sized: Scene[] = [];
  for (const sc of scenes) {
    const w = sc.endWordIndex - sc.startWordIndex + 1;
    if (w < MIN_SCENE_WORDS && sc.graphic === null && sized.length > 0) {
      sized[sized.length - 1]!.endWordIndex = sc.endWordIndex;
      notes.push(`merged tiny scene ${sc.id} into previous`);
      continue;
    }
    if (w > MAX_PLAIN_SCENE_WORDS && sc.graphic === null) {
      sized.push(...chopRange(sc.startWordIndex, sc.endWordIndex, sc.id, sized.length));
      continue;
    }
    sized.push({ ...sc });
  }
  scenes = sized;

  // 4. Per-scene fixes: clamp triggers into range, validate split config,
  //    check iconRow asset references.
  for (const sc of scenes) {
    if (sc.layout === "split" && !sc.splitConfig) {
      sc.splitConfig = { side: "left", ratio: 0.5 };
      notes.push(`scene ${sc.id}: defaulted splitConfig`);
    }
    if (sc.layout !== "split") sc.splitConfig = null;
    if (sc.layout !== "animation-full" && !sc.talkingHead) {
      sc.talkingHead = { zoom: "none" };
    }
    const g = sc.graphic;
    if (!g) continue;
    const clampT = (t: number) => {
      const c = Math.max(sc.startWordIndex, Math.min(sc.endWordIndex, t));
      if (c !== t) notes.push(`scene ${sc.id}: clamped trigger ${t}→${c}`);
      return c;
    };
    if ("triggerWordIndex" in g.props) {
      g.props.triggerWordIndex = clampT(g.props.triggerWordIndex);
    }
    if (g.component === "listReveal") {
      g.props.items = g.props.items.map((it) => ({
        ...it,
        triggerWordIndex: clampT(it.triggerWordIndex),
      }));
    }
    if (g.component === "iconRow") {
      const ok = g.props.items.filter((it) => it.assetIndex < g.assets.length);
      if (ok.length < g.props.items.length) {
        notes.push(`scene ${sc.id}: dropped iconRow items with bad assetIndex`);
      }
      if (ok.length < 2) {
        sc.graphic = null;
        notes.push(`scene ${sc.id}: iconRow degenerate — removed graphic`);
        continue;
      }
      g.props.items = ok.map((it) => ({ ...it, triggerWordIndex: clampT(it.triggerWordIndex) }));
    }
    if (g.component === "versus") {
      if (
        g.props.left.assetIndex >= g.assets.length ||
        g.props.right.assetIndex >= g.assets.length
      ) {
        sc.graphic = null;
        notes.push(`scene ${sc.id}: versus with bad assetIndex — removed graphic`);
        continue;
      }
      g.props.left.triggerWordIndex = clampT(g.props.left.triggerWordIndex);
      g.props.right.triggerWordIndex = clampT(g.props.right.triggerWordIndex);
    }
    if (g.component === "geoMap" && g.props.flagAssetIndex !== null) {
      if (g.props.flagAssetIndex >= g.assets.length) {
        g.props.flagAssetIndex = null;
        notes.push(`scene ${sc.id}: geoMap flagAssetIndex out of range — dropped flag`);
      }
    }
  }

  // 5. Captions: trim emphasis budget, drop out-of-range, space emoji.
  const captions = { ...plan.captions };
  const budget = Math.max(2, Math.floor(transcript.words.length * EMPHASIS_RATIO));
  captions.emphases = captions.emphases
    .filter((e) => e.wordIndex <= lastWord)
    .filter((e, i, arr) => arr.findIndex((x) => x.wordIndex === e.wordIndex) === i)
    .slice(0, budget);
  const seenEmoji: number[] = [];
  captions.emojiInserts = captions.emojiInserts
    .filter((e) => e.afterWordIndex <= lastWord)
    .filter((e) => {
      if (seenEmoji.some((s) => Math.abs(s - e.afterWordIndex) < 40)) return false;
      seenEmoji.push(e.afterWordIndex);
      return true;
    });

  // 6. Snap: word indices → ms on exact frame boundaries, contiguous.
  //    A scene cut lands in the silence between words, never mid-word.
  const words = transcript.words;
  const msToFrame = (ms: number) => Math.round((ms / 1000) * FPS);
  const frameToMs = (f: number) => Math.round((f / FPS) * 1000);
  const boundaryFrames: number[] = scenes.map((sc, k) => {
    if (k === 0) return 0;
    const w = words[sc.startWordIndex]!;
    const prev = words[sc.startWordIndex - 1];
    const gapMid = prev ? (prev.endMs + w.startMs) / 2 : Math.max(0, w.startMs - 120);
    return msToFrame(gapMid);
  });
  boundaryFrames.push(msToFrame(durationMs));
  // Strictly increasing with a minimum scene length; merge violations.
  const finalScenes: Scene[] = [];
  let startF = boundaryFrames[0]!;
  for (let k = 0; k < scenes.length; k++) {
    const endF = boundaryFrames[k + 1]!;
    if (endF - startF < MIN_SCENE_FRAMES) {
      // Too short after snapping: fold into the next scene (or previous for the last).
      if (k < scenes.length - 1) {
        boundaryFrames[k + 1] = startF;
        notes.push(`folded sub-minimum scene ${scenes[k]!.id} forward`);
        continue;
      }
      if (finalScenes.length > 0) {
        finalScenes[finalScenes.length - 1]!.endMs = frameToMs(endF);
        finalScenes[finalScenes.length - 1]!.endWordIndex = scenes[k]!.endWordIndex;
        notes.push(`folded final sub-minimum scene ${scenes[k]!.id} backward`);
        continue;
      }
    }
    finalScenes.push({
      ...scenes[k]!,
      startMs: frameToMs(startF),
      endMs: frameToMs(endF),
    });
    startF = endF;
  }
  if (finalScenes.length === 0) {
    throw new Error("Lint produced zero scenes — plan is structurally hopeless");
  }
  finalScenes[finalScenes.length - 1]!.endMs = frameToMs(msToFrame(durationMs));

  return { plan: { ...plan, captions, scenes: finalScenes }, notes };
};

// Terminal fallback when planning fails entirely: a valid, render-safe plan
// with captions only. Strictly better than blocking the render.
export const captionsOnlyPlan = (
  transcript: Transcript,
  source: EditPlan["source"],
  promptVersion: string,
): EditPlan => {
  const lastWord = transcript.words.length - 1;
  const base: EditPlan = {
    schemaVersion: 1,
    language: transcript.language,
    provenance: { promptVersion, model: "fallback", schemaVersion: 1 },
    source,
    style: { theme: "editorial-dark", motionIntensity: "subtle" },
    captions: {
      enabled: true,
      position: "bottom",
      preset: "editorial",
      emphases: [],
      emojiInserts: [],
    },
    scenes: [
      {
        id: "s1",
        startWordIndex: 0,
        endWordIndex: lastWord,
        startMs: null,
        endMs: null,
        layout: "talking-head-full",
        splitConfig: null,
        talkingHead: { zoom: "none" },
        transitionIn: "cut",
        graphic: null,
        rationale: "captions-only fallback",
      },
    ],
  };
  return lintAndSnap(base, transcript, source.durationMs).plan;
};
