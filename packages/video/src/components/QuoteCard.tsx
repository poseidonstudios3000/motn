import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT, SPACE, SPRINGS, THEME, TYPE } from "../lib/tokens";
import { useScene, useLocalTrigger } from "../lib/SceneContext";
import type { GraphicVariant } from "../layouts/GraphicHost";

// Full-frame pull quote: words cascade in fast, attribution settles last.
export const QuoteCard: React.FC<{
  quote: string;
  attribution: string | null;
  triggerWordIndex: number;
  variant: GraphicVariant;
}> = ({ quote, attribution, triggerWordIndex }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, intensity } = useScene();
  const t = THEME[theme];
  const start = useLocalTrigger(triggerWordIndex, fps);
  const words = quote.split(" ");

  const mark = spring({ frame: frame - start, fps, config: SPRINGS.soft, durationInFrames: 40 });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: SPACE.margin * 1.6,
        width: "100%",
        height: "100%",
        background: `radial-gradient(120% 90% at 50% 0%, rgba(255,216,77,0.10) 0%, rgba(0,0,0,0) 55%), ${t.bg}`,
      }}
    >
      <div
        style={{
          fontFamily: FONT.family,
          fontWeight: FONT.display,
          fontSize: 220,
          lineHeight: 0.6,
          color: t.accent,
          opacity: mark,
          transform: `translateY(${(1 - mark) * -40}px)`,
        }}
      >
        “
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          fontSize: TYPE.h2, // em gap must resolve against the word size
          gap: "0.3em",
          marginTop: 40,
        }}
      >
        {words.map((w, i) => {
          const s = spring({
            frame: frame - start - i * 1.4,
            fps,
            config: SPRINGS.soft,
            durationInFrames: 28,
          });
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                fontFamily: FONT.family,
                fontWeight: FONT.bold,
                fontSize: TYPE.h2,
                lineHeight: 1.22,
                color: t.text,
                opacity: s,
                transform: `translateY(${(1 - s) * 34 * intensity}px)`,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
      {attribution ? (
        <div
          style={{
            marginTop: 54,
            fontFamily: FONT.family,
            fontWeight: FONT.medium,
            fontSize: TYPE.body,
            color: t.textDim,
            opacity: spring({
              frame: frame - start - words.length * 1.4 - 8,
              fps,
              config: SPRINGS.soft,
              durationInFrames: 30,
            }),
          }}
        >
          — {attribution}
        </div>
      ) : null}
    </div>
  );
};
