import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { EASE, FONT, SPACE, THEME, TYPE } from "../lib/tokens";
import { useScene, useLocalTrigger } from "../lib/SceneContext";
import { useTriggerSpring } from "../lib/timing";
import type { GraphicVariant } from "../layouts/GraphicHost";

// The edutainment signature: a number that counts up exactly when the
// speaker says it.
export const StatCounter: React.FC<{
  value: number;
  prefix: string | null;
  suffix: string | null;
  label: string;
  triggerWordIndex: number;
  variant: GraphicVariant;
}> = ({ value, prefix, suffix, label, triggerWordIndex, variant }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme } = useScene();
  const t = THEME[theme];
  const triggerFrame = useLocalTrigger(triggerWordIndex, fps);
  const pop = useTriggerSpring(triggerFrame);

  const progress = interpolate(frame - triggerFrame, [0, Math.round(fps * 1.1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.snap,
  });
  const isInt = Number.isInteger(value);
  const shown = isInt
    ? Math.round(value * progress).toLocaleString("en-US")
    : (value * progress).toFixed(1);

  const scale = variant === "overlay" ? 0.82 : 1;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: SPACE.panelPad,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          fontFamily: FONT.family,
          fontWeight: FONT.display,
          fontSize: TYPE.stat,
          lineHeight: 1,
          color: t.accent,
          fontVariantNumeric: "tabular-nums",
          transform: `scale(${0.85 + 0.15 * pop})`,
          opacity: Math.min(1, pop * 2),
          textShadow: variant === "overlay" ? "0 8px 40px rgba(0,0,0,0.7)" : undefined,
          letterSpacing: "-0.03em",
        }}
      >
        {prefix ?? ""}
        {shown}
        {suffix ?? ""}
      </div>
      <div
        style={{
          marginTop: 22,
          maxWidth: 640,
          textAlign: "center",
          fontFamily: FONT.family,
          fontWeight: FONT.bold,
          fontSize: TYPE.body,
          lineHeight: 1.25,
          // Label is present (dim) from scene start so the panel never reads
          // empty, then commits to full strength as the number lands.
          color: frame < triggerFrame ? t.textDim : t.text,
          opacity: interpolate(frame, [0, 10], [0, 0.9], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          textShadow: variant === "overlay" ? "0 4px 24px rgba(0,0,0,0.65)" : undefined,
        }}
      >
        {label}
      </div>
    </div>
  );
};
