import { useMemo } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import worldData from "world-atlas/countries-110m.json";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { EASE, FONT, SPACE, SPRINGS, THEME, TYPE } from "../lib/tokens";
import { useScene, useLocalTrigger } from "../lib/SceneContext";
import type { GraphicVariant } from "../layouts/GraphicHost";

// Real geography, rendered deterministically from bundled TopoJSON — no
// tiles, no network. The camera starts on the world and lands on the spoken
// country exactly at its trigger word.

const VB = 1000; // design-space viewBox; SVG scales responsively

// world-atlas ships TopoJSON; we cast through the topojson-client call once
// rather than re-declaring the full Topology type.
const world = worldData as unknown as {
  objects: { countries: never };
};
const countries = feature(
  world as never,
  world.objects.countries,
) as unknown as FeatureCollection<Geometry, { name: string }>;

// world-atlas names are canonical ("United States of America"); accept the
// names an LLM will plausibly emit.
const NAME_ALIASES: Record<string, string> = {
  "united states": "united states of america",
  usa: "united states of america",
  us: "united states of america",
  uk: "united kingdom",
  britain: "united kingdom",
  "south korea": "south korea",
  korea: "south korea",
};

const findCountry = (query: string) => {
  const q = query.toLowerCase().trim();
  const target = NAME_ALIASES[q] ?? q;
  return (
    countries.features.find((f) => f.properties.name.toLowerCase() === target) ??
    countries.features.find((f) => f.properties.name.toLowerCase().includes(target)) ??
    null
  );
};

export const GeoMap: React.FC<{
  country: string;
  label: string;
  flagAssetIndex: number | null;
  flagSvg?: string | null;
  triggerWordIndex: number;
  variant: GraphicVariant;
}> = ({ country, label, flagSvg, triggerWordIndex }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { theme, intensity } = useScene();
  const t = THEME[theme];
  const triggerFrame = useLocalTrigger(triggerWordIndex, fps);

  const { paths, targetPath, zoom } = useMemo(() => {
    const projection = geoNaturalEarth1().fitExtent(
      [
        [VB * 0.04, VB * 0.18],
        [VB * 0.96, VB * 0.82],
      ],
      { type: "Sphere" },
    );
    const pathGen = geoPath(projection);
    const target = findCountry(country);
    let z = { k: 1, cx: VB / 2, cy: VB / 2 };
    if (target) {
      const [[x0, y0], [x1, y1]] = pathGen.bounds(target);
      const k = Math.min(6.5, Math.max(1.8, (0.55 * VB) / Math.max(x1 - x0, y1 - y0)));
      z = { k, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    }
    return {
      paths: countries.features.map((f) => pathGen(f) ?? ""),
      targetPath: target ? (pathGen(target) ?? "") : "",
      zoom: z,
    };
  }, [country]);

  // Camera: world → country, landing on the trigger word.
  const p = interpolate(frame - triggerFrame + 24, [0, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.glide,
  });
  const k = 1 + (zoom.k - 1) * p;
  const cx = VB / 2 + (zoom.cx - VB / 2) * p;
  const cy = VB / 2 + (zoom.cy - VB / 2) * p;

  // Target country commits as it's spoken; gentle breathing after landing.
  const landed = spring({ frame: frame - triggerFrame, fps, config: SPRINGS.soft, durationInFrames: 40 });
  const pulse = 0.55 + 0.25 * landed + 0.1 * Math.sin((frame - triggerFrame) / 9);
  const mapIn = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const chipIn = spring({ frame: frame - triggerFrame - 6, fps, config: SPRINGS.punch, durationInFrames: 30 });

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", opacity: mapIn }}>
      <svg
        viewBox={`0 0 ${VB} ${VB}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%" }}
      >
        <g transform={`translate(${VB / 2},${VB / 2}) scale(${k}) translate(${-cx},${-cy})`}>
          {paths.map((d, i) =>
            d ? (
              <path
                key={i}
                d={d}
                fill="#18202e"
                stroke="rgba(245,247,250,0.16)"
                strokeWidth={1.1 / k}
              />
            ) : null,
          )}
          {targetPath ? (
            <path
              d={targetPath}
              fill={t.accent}
              fillOpacity={pulse * 0.75}
              stroke={t.accent}
              strokeWidth={2.4 / k}
            />
          ) : null}
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: SPACE.panelPad, // top of the panel — the bottom belongs to captions
          transform: `translateX(-50%) scale(${0.7 + 0.3 * chipIn})`,
          opacity: chipIn,
          display: "flex",
          alignItems: "center",
          gap: 20,
          background: t.panel,
          border: `2px solid ${t.panelBorder}`,
          borderRadius: 999,
          padding: "16px 34px 16px 18px",
          boxShadow: t.shadow,
        }}
      >
        {flagSvg ? (
          <div
            className="motn-flag"
            style={{ width: 64, height: 64, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}
            dangerouslySetInnerHTML={{ __html: flagSvg }}
          />
        ) : (
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: t.accent,
              color: "#0B0E14",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT.family,
              fontWeight: FONT.display,
              fontSize: 30,
            }}
          >
            {label.charAt(0)}
          </div>
        )}
        <span
          style={{
            fontFamily: FONT.family,
            fontWeight: FONT.display,
            fontSize: TYPE.h2 * 0.72 * (0.9 + 0.1 * intensity),
            color: t.text,
            letterSpacing: "0.01em",
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
};
