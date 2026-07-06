import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { FONT, SPACE, SPRINGS, THEME, TYPE, EASE } from "../lib/tokens";
import { useScene } from "../lib/SceneContext";
import type { GraphicVariant } from "../layouts/GraphicHost";

// First-3-seconds title card: massive words landing one by one over the
// speaker, with a scrim for legibility and an accent underline that draws in.
export const HookTitle: React.FC<{
  title: string;
  subtitle: string | null;
  variant: GraphicVariant;
}> = ({ title, subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, intensity } = useScene();
  const t = THEME[theme];
  const words = title.toUpperCase().split(" ");

  const underline = interpolate(frame, [words.length * 3 + 6, words.length * 3 + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.snap,
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.52) 55%, rgba(0,0,0,0.18) 100%)",
        padding: SPACE.margin,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          // em gap resolves against the container font-size, so it must match
          // the word size — otherwise words visually concatenate.
          fontSize: TYPE.display,
          gap: "0.28em",
          maxWidth: "92%",
        }}
      >
        {words.map((w, i) => {
          const s = spring({
            frame: frame - i * 3,
            fps,
            config: SPRINGS.punch,
            durationInFrames: 30,
          });
          return (
            <span
              key={i}
              style={{
                fontFamily: FONT.family,
                fontWeight: FONT.display,
                fontSize: TYPE.display,
                lineHeight: 1.04,
                color: t.text,
                opacity: s,
                display: "inline-block",
                transform: `translateY(${(1 - s) * 70 * intensity}px) scale(${0.9 + 0.1 * s})`,
                textShadow: "0 8px 40px rgba(0,0,0,0.65)",
                letterSpacing: "-0.01em",
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 34,
          height: 14,
          width: `${underline * 34}%`,
          background: t.accent,
          borderRadius: 7,
        }}
      />
      {subtitle ? (
        <div
          style={{
            marginTop: 30,
            fontFamily: FONT.family,
            fontWeight: FONT.medium,
            fontSize: TYPE.body,
            color: t.textDim,
            opacity: underline,
            textShadow: "0 4px 24px rgba(0,0,0,0.6)",
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
};
