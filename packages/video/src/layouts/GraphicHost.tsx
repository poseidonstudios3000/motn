import { useVideoConfig } from "remotion";
import type { Scene } from "@motn/schema";
import { SAFE_ZONES } from "@motn/schema";
import { SPACE, THEME } from "../lib/tokens";
import { useEnterExit } from "../lib/timing";
import { useScene } from "../lib/SceneContext";
import { graphicRectFor } from "./layout";
import { HookTitle } from "../components/HookTitle";
import { KineticText } from "../components/KineticText";
import { StatCounter } from "../components/StatCounter";
import { ListReveal } from "../components/ListReveal";
import { IconRow } from "../components/IconRow";
import { QuoteCard } from "../components/QuoteCard";
import { LowerThird } from "../components/LowerThird";
import { GeoMap } from "../components/GeoMap";
import { Versus } from "../components/Versus";

// Mounts a scene's graphic in the right region with the plan's enter/exit
// envelope. variant tells components how they sit:
//   overlay — floating over the full-frame speaker (no backdrop)
//   panel   — the non-speaker half of a split (soft panel backdrop)
//   full    — animation-full, owns the whole canvas
export type GraphicVariant = "overlay" | "panel" | "full";

export const GraphicHost: React.FC<{ scene: Scene }> = ({ scene }) => {
  const { width: W, height: H } = useVideoConfig();
  const { intensity, theme, sceneDurationFrames, captionsBottom } = useScene();
  const t = THEME[theme];
  const g = scene.graphic;
  const envelope = useEnterExit(
    sceneDurationFrames,
    g?.enter ?? "fade",
    g?.exit ?? "fade",
    intensity,
  );
  if (!g) return null;

  const variant: GraphicVariant =
    scene.layout === "split" ? "panel" : scene.layout === "animation-full" ? "full" : "overlay";
  const rect = graphicRectFor(scene, W, H);

  const inner = (() => {
    switch (g.component) {
      case "hookTitle":
        return <HookTitle {...g.props} variant={variant} />;
      case "kineticText":
        return <KineticText {...g.props} variant={variant} />;
      case "statCounter":
        return <StatCounter {...g.props} variant={variant} />;
      case "listReveal":
        return <ListReveal {...g.props} variant={variant} />;
      case "iconRow":
        return <IconRow {...g.props} assets={g.assets} variant={variant} />;
      case "quoteCard":
        return <QuoteCard {...g.props} variant={variant} />;
      case "lowerThird":
        return <LowerThird {...g.props} variant={variant} />;
      case "geoMap":
        return (
          <GeoMap
            {...g.props}
            flagSvg={
              g.props.flagAssetIndex !== null
                ? (g.assets[g.props.flagAssetIndex]?.resolvedSvg ?? null)
                : null
            }
            variant={variant}
          />
        );
      case "versus":
        return <Versus {...g.props} assets={g.assets} variant={variant} />;
    }
  })();

  // Split panels get chrome (so the region reads designed even before the
  // graphic's trigger word lands) and keep clear of the bottom caption slot.
  const scale = H / SAFE_ZONES.reference.height;
  const panelInset = SPACE.gutter * scale;
  const panelBottomInset = captionsBottom
    ? (SAFE_ZONES.bottomReservePx - 40) * scale
    : panelInset;

  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        opacity: envelope.opacity,
        transform: envelope.transform,
        background: variant === "full" ? t.bg : undefined,
        overflow: "hidden",
      }}
    >
      {variant === "panel" ? (
        <div
          style={{
            position: "absolute",
            left: panelInset,
            right: panelInset,
            top: panelInset,
            bottom: panelBottomInset,
            background: t.panel,
            border: `2px solid ${t.panelBorder}`,
            borderRadius: SPACE.radius,
            boxShadow: t.shadow,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {inner}
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {inner}
        </div>
      )}
    </div>
  );
};
