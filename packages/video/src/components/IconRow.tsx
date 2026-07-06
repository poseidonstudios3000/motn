import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Asset } from "@motn/schema";
import { FONT, SPACE, SPRINGS, THEME, TYPE } from "../lib/tokens";
import { useScene } from "../lib/SceneContext";
import type { GraphicVariant } from "../layouts/GraphicHost";

// 2–4 icons + labels popping in sequence. Icons arrive as inlined Lucide SVG
// (resolved offline); a resolver miss degrades to a lettermark chip.
export const IconRow: React.FC<{
  items: Array<{ label: string; assetIndex: number; triggerWordIndex: number }>;
  assets: Asset[];
  variant: GraphicVariant;
}> = ({ items, assets }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, words, sceneStartFrame } = useScene();
  const t = THEME[theme];

  const localTrigger = (wi: number) => {
    const w = words[Math.min(wi, words.length - 1)];
    return Math.max(0, (w ? Math.round((w.startMs / 1000) * fps) : 0) - sceneStartFrame);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        gap: SPACE.gutter * 2,
        padding: SPACE.panelPad,
        flexWrap: items.length === 4 ? "wrap" : "nowrap",
        maxWidth: 980,
      }}
    >
      {items.map((item, i) => {
        const s = spring({
          frame: frame - localTrigger(item.triggerWordIndex),
          fps,
          config: SPRINGS.punch,
          durationInFrames: 34,
        });
        const svg = assets[item.assetIndex]?.resolvedSvg ?? null;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 22,
              width: items.length === 4 ? "40%" : 220,
              opacity: s,
              transform: `translateY(${(1 - s) * 50}px) scale(${0.7 + 0.3 * s})`,
            }}
          >
            <div
              style={{
                width: 150,
                height: 150,
                borderRadius: 40,
                background: t.panel,
                border: `2px solid ${t.panelBorder}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: t.accent,
                boxShadow: t.shadow,
              }}
            >
              {svg ? (
                <div
                  className="motn-icon"
                  style={{ width: 84, height: 84 }}
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              ) : (
                <span
                  style={{
                    fontFamily: FONT.family,
                    fontWeight: FONT.display,
                    fontSize: 64,
                  }}
                >
                  {item.label.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div
              style={{
                fontFamily: FONT.family,
                fontWeight: FONT.bold,
                fontSize: TYPE.label,
                textAlign: "center",
                lineHeight: 1.2,
                color: t.text,
              }}
            >
              {item.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};
