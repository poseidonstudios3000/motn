import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT, SPACE, SPRINGS, THEME, TYPE } from "../lib/tokens";
import { useScene } from "../lib/SceneContext";
import type { GraphicVariant } from "../layouts/GraphicHost";

// Checklist/step build-up: each item lands exactly as the speaker reaches it.
export const ListReveal: React.FC<{
  title: string | null;
  items: Array<{ text: string; triggerWordIndex: number }>;
  variant: GraphicVariant;
}> = ({ title, items, variant }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, intensity, words, sceneStartFrame } = useScene();
  const t = THEME[theme];

  const localTrigger = (wi: number) => {
    const w = words[Math.min(wi, words.length - 1)];
    return Math.max(0, (w ? Math.round((w.startMs / 1000) * fps) : 0) - sceneStartFrame);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 34,
        padding: SPACE.panelPad,
        width: "100%",
        maxWidth: 960,
      }}
    >
      {title ? (
        <div
          style={{
            fontFamily: FONT.family,
            fontWeight: FONT.display,
            fontSize: TYPE.h2,
            color: t.text,
            marginBottom: 8,
          }}
        >
          {title}
        </div>
      ) : null}
      {items.map((item, i) => {
        const s = spring({
          frame: frame - localTrigger(item.triggerWordIndex),
          fps,
          config: SPRINGS.punch,
          durationInFrames: 34,
        });
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 30,
              opacity: s,
              transform: `translateX(${(1 - s) * 70 * intensity}px)`,
            }}
          >
            <div
              style={{
                width: 74,
                height: 74,
                borderRadius: 22,
                flexShrink: 0,
                background: t.accent,
                color: "#0B0E14",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT.family,
                fontWeight: FONT.display,
                fontSize: 42,
                transform: `scale(${0.6 + 0.4 * s})`,
              }}
            >
              {i + 1}
            </div>
            <div
              style={{
                fontFamily: FONT.family,
                fontWeight: FONT.bold,
                fontSize: TYPE.body,
                lineHeight: 1.22,
                color: t.text,
                textShadow: variant === "overlay" ? "0 4px 24px rgba(0,0,0,0.65)" : undefined,
              }}
            >
              {item.text}
            </div>
          </div>
        );
      })}
    </div>
  );
};
