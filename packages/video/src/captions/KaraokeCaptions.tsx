import { useMemo } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CaptionsConfig } from "@motn/schema";
import { SAFE_ZONES } from "@motn/schema";
import { FONT, SPRINGS, THEME, TYPE, type ThemeName } from "../lib/tokens";
import type { WordTime } from "../lib/timing";

// Word-synced karaoke captions with keyword emphasis and emoji inserts.
// Pages of ≤4 words; the active word highlights as it is spoken. Slots are
// safe-zone aware (top-center below the platform UI band, bottom above the
// like/share rail) and come from versioned config, not constants.

type Page = { start: number; end: number; words: WordTime[] };

const MAX_WORDS_PER_PAGE = 4;
const PAGE_GAP_MS = 700;

const buildPages = (words: WordTime[]): Page[] => {
  const pages: Page[] = [];
  let current: WordTime[] = [];
  const flush = () => {
    if (!current.length) return;
    pages.push({
      start: current[0]!.startMs,
      end: current[current.length - 1]!.endMs,
      words: current,
    });
    current = [];
  };
  for (let k = 0; k < words.length; k++) {
    const w = words[k]!;
    current.push(w);
    const next = words[k + 1];
    const punct = /[.!?,;:]$/.test(w.text);
    const gap = next ? next.startMs - w.endMs : Infinity;
    if (current.length >= MAX_WORDS_PER_PAGE || punct || gap > PAGE_GAP_MS) flush();
  }
  flush();
  // Pages stay visible until the next page starts (no flicker between pages).
  for (let k = 0; k < pages.length - 1; k++) pages[k]!.end = pages[k + 1]!.start;
  return pages;
};

export const KaraokeCaptions: React.FC<{
  captions: CaptionsConfig;
  words: WordTime[];
  theme: ThemeName;
}> = ({ captions, words, theme }) => {
  const frame = useCurrentFrame();
  const { fps, height: H, width: W } = useVideoConfig();
  const t = THEME[theme];
  const pages = useMemo(() => buildPages(words), [words]);
  const emphasisByWord = useMemo(
    () => new Map(captions.emphases.map((e) => [e.wordIndex, e.effect])),
    [captions.emphases],
  );
  const emojiByWord = useMemo(
    () => new Map(captions.emojiInserts.map((e) => [e.afterWordIndex, e.emoji])),
    [captions.emojiInserts],
  );

  const nowMs = (frame / fps) * 1000;
  const page = pages.find((p) => nowMs >= p.start && nowMs < p.end);
  if (!page) return null;

  const punchy = captions.preset === "punchy";
  const scale = H / SAFE_ZONES.reference.height;
  const slotStyle: React.CSSProperties =
    captions.position === "top-center"
      ? { top: (SAFE_ZONES.topBandPx + 60) * scale }
      : { bottom: SAFE_ZONES.bottomReservePx * scale };

  return (
    <div
      style={{
        position: "absolute",
        left: SAFE_ZONES.sideMarginPx * scale,
        right: SAFE_ZONES.sideMarginPx * scale,
        ...slotStyle,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap: "0.24em",
        textAlign: "center",
      }}
    >
      {page.words.map((w, k) => {
        const active = nowMs >= w.startMs && nowMs < w.endMs + 60;
        // Karaoke: the whole page lands together (tiny stagger), then the
        // highlight travels word-by-word — words never pop in from nothing
        // mid-sentence.
        const pageStartFrame = Math.round((page.start / 1000) * fps);
        const popIn = spring({
          frame: frame - pageStartFrame - k * 1.2,
          fps,
          config: SPRINGS.punch,
          durationInFrames: 20,
        });
        const emphasis = emphasisByWord.get(w.i);
        const emoji = emojiByWord.get(w.i);
        const base: React.CSSProperties = {
          display: "inline-block",
          fontFamily: FONT.family,
          fontWeight: punchy ? FONT.display : FONT.medium,
          fontSize: (punchy ? TYPE.caption : TYPE.captionEditorial) * (W / 1080),
          lineHeight: 1.25,
          color: t.text,
          textShadow: "0 4px 26px rgba(0,0,0,0.85), 0 1px 6px rgba(0,0,0,0.9)",
          opacity: punchy ? popIn : Math.min(1, popIn * 1.4),
          transform: punchy ? `scale(${0.8 + 0.2 * popIn})` : undefined,
          textTransform: punchy ? "uppercase" : undefined,
          borderRadius: 14,
          padding: "0.02em 0.18em",
        };
        if (active && punchy) {
          base.background = t.captionActiveBg;
          base.color = t.captionActiveText;
          base.textShadow = "none";
          base.transform = `scale(${(0.8 + 0.2 * popIn) * 1.06})`;
        } else if (active) {
          base.color = t.accent;
        } else if (emphasis === "color") {
          base.color = t.accent;
        } else if (emphasis === "scale") {
          base.transform = `${base.transform ?? ""} scale(1.08)`.trim();
        } else if (emphasis === "underline") {
          base.textDecoration = `underline 6px ${t.accent}`;
          base.textUnderlineOffset = "0.14em";
        }
        return (
          <span key={w.i} style={base}>
            {w.text}
            {emoji ? <span style={{ marginLeft: "0.18em" }}>{emoji}</span> : null}
          </span>
        );
      })}
    </div>
  );
};
