import { describe, expect, it } from "vitest";
import type { EditPlan, Transcript } from "@motn/schema";
import { EditPlanSchema } from "@motn/schema";
import { captionsOnlyPlan, lintAndSnap } from "../src/stages/lint";
import { mockAnalyze } from "../src/stages/mock-analyze";
import { mockPlan } from "../src/stages/mock-plan";
import { segmentsFromWords } from "../src/stages/transcribe/adapter";

const FPS = 30;
const SCRIPT =
  "Here is the thing nobody tells you about making videos. Most people quit after their first ten uploads. But the data says something wild: 87 percent of channels that post one hundred videos cross one thousand subscribers. So the game is simple. First, pick one topic you can talk about forever. Second, publish on a schedule you can actually keep. Third, study your retention graph every single week. Do that for one year and you will beat almost everyone, because almost everyone quits.";

const makeTranscript = (): Transcript => {
  const tokens = SCRIPT.split(" ");
  const words: Transcript["words"] = [];
  let t = 800;
  tokens.forEach((text, i) => {
    const dur = 220 + text.length * 40;
    words.push({ i, text, startMs: t, endMs: t + dur - 60, confidence: 1, chars: null });
    t += dur + (/[.!?]$/.test(text) ? 400 : 40);
  });
  return {
    schemaVersion: 1,
    language: "en",
    provider: "mock",
    words,
    segments: segmentsFromWords(words),
    events: null,
  };
};

const DURATION_MS = 46000;

const makePlan = (transcript: Transcript): EditPlan => {
  const analysis = {
    schemaVersion: 1 as const,
    provenance: { promptVersion: "t@1", model: "mock", schemaVersion: 1 },
    ...mockAnalyze(transcript),
  };
  return {
    schemaVersion: 1,
    language: "en",
    provenance: { promptVersion: "t@1", model: "mock", schemaVersion: 1 },
    source: { durationMs: DURATION_MS, fps: FPS, width: 1080, height: 1920 },
    ...mockPlan(analysis, transcript),
  };
};

describe("lintAndSnap invariants", () => {
  const transcript = makeTranscript();
  const { plan } = lintAndSnap(makePlan(transcript), transcript, DURATION_MS);

  it("produces a valid EditPlan", () => {
    expect(() => EditPlanSchema.parse(plan)).not.toThrow();
  });

  it("covers the full timeline contiguously on frame boundaries", () => {
    expect(plan.scenes[0]!.startMs).toBe(0);
    for (let i = 0; i < plan.scenes.length; i++) {
      const sc = plan.scenes[i]!;
      expect(sc.startMs).not.toBeNull();
      expect(sc.endMs).not.toBeNull();
      // frame-exact boundaries
      const startFrame = (sc.startMs! / 1000) * FPS;
      expect(Math.abs(startFrame - Math.round(startFrame))).toBeLessThan(0.02);
      if (i > 0) expect(sc.startMs).toBe(plan.scenes[i - 1]!.endMs);
      expect(sc.endMs!).toBeGreaterThan(sc.startMs!);
    }
    const last = plan.scenes[plan.scenes.length - 1]!;
    const lastFrame = Math.round((DURATION_MS / 1000) * FPS);
    expect(Math.round((last.endMs! / 1000) * FPS)).toBe(lastFrame);
  });

  it("covers all words in order without overlap", () => {
    let cursor = 0;
    for (const sc of plan.scenes) {
      expect(sc.startWordIndex).toBe(cursor === 0 ? 0 : cursor);
      expect(sc.endWordIndex).toBeGreaterThanOrEqual(sc.startWordIndex);
      cursor = sc.endWordIndex + 1;
    }
    expect(cursor - 1).toBe(transcript.words.length - 1);
  });

  it("keeps every trigger inside its scene", () => {
    for (const sc of plan.scenes) {
      const g = sc.graphic;
      if (!g) continue;
      const triggers: number[] = [];
      if ("triggerWordIndex" in g.props) triggers.push(g.props.triggerWordIndex);
      if (g.component === "listReveal") {
        triggers.push(...g.props.items.map((i) => i.triggerWordIndex));
      }
      for (const tr of triggers) {
        expect(tr).toBeGreaterThanOrEqual(sc.startWordIndex);
        expect(tr).toBeLessThanOrEqual(sc.endWordIndex);
      }
    }
  });

  it("respects the emphasis budget", () => {
    expect(plan.captions.emphases.length).toBeLessThanOrEqual(
      Math.max(2, Math.floor(transcript.words.length * 0.08)),
    );
  });

  it("uses the visual moments the analysis found", () => {
    const components = plan.scenes.map((s) => s.graphic?.component).filter(Boolean);
    expect(components).toContain("hookTitle");
    expect(components).toContain("statCounter");
    expect(components).toContain("listReveal");
  });
});

describe("captionsOnlyPlan fallback", () => {
  it("is always valid and renderable", () => {
    const transcript = makeTranscript();
    const plan = captionsOnlyPlan(
      transcript,
      { durationMs: DURATION_MS, fps: FPS, width: 1080, height: 1920 },
      "t@1",
    );
    expect(() => EditPlanSchema.parse(plan)).not.toThrow();
    expect(plan.captions.enabled).toBe(true);
    expect(plan.scenes.length).toBeGreaterThanOrEqual(1);
    expect(plan.scenes[0]!.startMs).toBe(0);
  });
});

describe("degenerate inputs", () => {
  it("survives a hopeless LLM plan via auto-fix", () => {
    const transcript = makeTranscript();
    const broken = makePlan(transcript);
    // Inverted, overlapping, out-of-range scenes:
    broken.scenes = [
      { ...broken.scenes[0]!, startWordIndex: 50, endWordIndex: 10 },
      { ...broken.scenes[1]!, startWordIndex: 5, endWordIndex: 9999 },
    ];
    const { plan } = lintAndSnap(broken, transcript, DURATION_MS);
    expect(() => EditPlanSchema.parse(plan)).not.toThrow();
    let cursor = 0;
    for (const sc of plan.scenes) {
      expect(sc.startWordIndex).toBe(cursor);
      cursor = sc.endWordIndex + 1;
    }
  });
});
