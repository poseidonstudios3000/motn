import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT, SPACE, SPRINGS, THEME, TYPE } from "../lib/tokens";
import { useScene, useLocalTrigger } from "../lib/SceneContext";
import type { GraphicVariant } from "../layouts/GraphicHost";

// Name/context introduction, sitting above the caption safe area.
export const LowerThird: React.FC<{
  name: string;
  subtitle: string | null;
  triggerWordIndex: number;
  variant: GraphicVariant;
}> = ({ name, subtitle, triggerWordIndex }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme } = useScene();
  const t = THEME[theme];
  const start = useLocalTrigger(triggerWordIndex, fps);
  const s = spring({ frame: frame - start, fps, config: SPRINGS.punch, durationInFrames: 34 });

  return (
    <div
      style={{
        position: "absolute",
        left: SPACE.margin,
        bottom: 560, // clear of both caption slots
        display: "flex",
        alignItems: "stretch",
        gap: 24,
        opacity: s,
        transform: `translateX(${(1 - s) * -80}px)`,
      }}
    >
      <div style={{ width: 14, borderRadius: 7, background: t.accent }} />
      <div
        style={{
          background: t.panel,
          border: `2px solid ${t.panelBorder}`,
          borderRadius: SPACE.radiusSmall,
          padding: "26px 40px",
          boxShadow: t.shadow,
        }}
      >
        <div
          style={{
            fontFamily: FONT.family,
            fontWeight: FONT.display,
            fontSize: TYPE.body,
            color: t.text,
          }}
        >
          {name}
        </div>
        {subtitle ? (
          <div
            style={{
              marginTop: 6,
              fontFamily: FONT.family,
              fontWeight: FONT.medium,
              fontSize: TYPE.label,
              color: t.textDim,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
};
