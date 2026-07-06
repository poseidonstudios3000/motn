import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import type { Asset } from "@motn/schema";
import { EASE, FONT, SPACE, SPRINGS, THEME, TYPE } from "../lib/tokens";
import { useScene } from "../lib/SceneContext";
import type { GraphicVariant } from "../layouts/GraphicHost";

// The matchup card: two contenders enter on their own spoken words, the VS
// bolt slams in once both are on stage.

type Side = { label: string; assetIndex: number; triggerWordIndex: number };

const SideCard: React.FC<{
  side: Side;
  asset: Asset | undefined;
  align: "left" | "right";
  accent: string;
}> = ({ side, asset, align, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, intensity, words, sceneStartFrame } = useScene();
  const t = THEME[theme];
  const w = words[Math.min(side.triggerWordIndex, words.length - 1)];
  const trigger = Math.max(0, (w ? Math.round((w.startMs / 1000) * fps) : 0) - sceneStartFrame);
  const s = spring({ frame: frame - trigger, fps, config: SPRINGS.punch, durationInFrames: 34 });
  const fromX = (align === "left" ? -1 : 1) * 160 * intensity;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 28,
        width: 380,
        padding: "54px 24px",
        background: t.panel,
        border: `3px solid ${accent}`,
        borderRadius: SPACE.radius,
        boxShadow: t.shadow,
        opacity: s,
        transform: `translateX(${(1 - s) * fromX}px) scale(${0.85 + 0.15 * s})`,
      }}
    >
      {asset?.resolvedSvg ? (
        <div
          className="motn-flag"
          style={{ width: 170, height: 170, borderRadius: "50%", overflow: "hidden" }}
          dangerouslySetInnerHTML={{ __html: asset.resolvedSvg }}
        />
      ) : (
        <div
          style={{
            width: 170,
            height: 170,
            borderRadius: "50%",
            background: accent,
            color: "#0B0E14",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONT.family,
            fontWeight: FONT.display,
            fontSize: 80,
          }}
        >
          {side.label.charAt(0)}
        </div>
      )}
      <div
        style={{
          fontFamily: FONT.family,
          fontWeight: FONT.display,
          fontSize: TYPE.h2,
          color: t.text,
          textAlign: "center",
          lineHeight: 1.1,
        }}
      >
        {side.label}
      </div>
    </div>
  );
};

export const Versus: React.FC<{
  left: Side;
  right: Side;
  assets: Asset[];
  variant: GraphicVariant;
}> = ({ left, right, assets }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, words, sceneStartFrame } = useScene();
  const t = THEME[theme];

  const secondTrigger = Math.max(
    ...[left, right].map((s) => {
      const w = words[Math.min(s.triggerWordIndex, words.length - 1)];
      return Math.max(0, (w ? Math.round((w.startMs / 1000) * fps) : 0) - sceneStartFrame);
    }),
  );
  const vs = spring({
    frame: frame - secondTrigger - 4,
    fps,
    config: SPRINGS.punch,
    durationInFrames: 26,
  });
  const bgGlow = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.snap,
  });

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 34,
        background: `radial-gradient(90% 60% at 50% 45%, rgba(255,216,77,${0.12 * bgGlow}) 0%, rgba(0,0,0,0) 60%), ${t.bg}`,
      }}
    >
      <SideCard side={left} asset={assets[left.assetIndex]} align="left" accent={t.accent} />
      <div
        style={{
          position: "absolute",
          zIndex: 2,
          fontFamily: FONT.family,
          fontWeight: FONT.display,
          fontSize: 150,
          color: t.text,
          textShadow: `0 0 60px rgba(255,216,77,0.55), 0 10px 40px rgba(0,0,0,0.8)`,
          opacity: vs,
          transform: `scale(${0.4 + 0.6 * vs}) rotate(${(1 - vs) * -14}deg)`,
          letterSpacing: "-0.04em",
        }}
      >
        VS
      </div>
      <SideCard side={right} asset={assets[right.assetIndex]} align="right" accent={t.accentAlt} />
    </div>
  );
};
