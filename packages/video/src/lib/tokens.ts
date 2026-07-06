import { Easing } from "remotion";

// The design-token layer. Every component imports from here — it is the
// single cheapest lever for making AI-assembled scenes feel like one editor
// cut the video. Values are px on the reference 1080×1920 canvas.

export const THEME = {
  "editorial-dark": {
    bg: "#0B0E14",
    panel: "rgba(16, 20, 30, 0.92)",
    panelBorder: "rgba(255, 255, 255, 0.08)",
    text: "#F5F7FA",
    textDim: "rgba(245, 247, 250, 0.6)",
    accent: "#FFD84D",
    accentAlt: "#5EE0A0",
    captionActiveBg: "#FFD84D",
    captionActiveText: "#0B0E14",
    shadow: "0 24px 80px rgba(0,0,0,0.55)",
  },
} as const;
export type ThemeName = keyof typeof THEME;

export const FONT = {
  // Loaded from public/fonts when present; graceful system fallback.
  family: "'MotnSans', 'Inter', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  display: 900,
  bold: 700,
  medium: 500,
} as const;

// Modular type scale for the 1080×1920 canvas.
export const TYPE = {
  display: 118,
  h1: 88,
  h2: 66,
  stat: 190,
  body: 46,
  caption: 58,
  captionEditorial: 50,
  label: 38,
} as const;

export const SPACE = {
  margin: 64, // side safe margin
  gutter: 28,
  panelPad: 56,
  radius: 36,
  radiusSmall: 20,
} as const;

// One named easing/spring set — every motion in the system uses these.
export const EASE = {
  snap: Easing.bezier(0.16, 1, 0.3, 1), // decisive settle (expo-out family)
  glide: Easing.bezier(0.45, 0, 0.15, 1), // layout morphs
  in: Easing.bezier(0.55, 0, 0.85, 0.35),
} as const;

export const SPRINGS = {
  punch: { damping: 11, mass: 0.6, stiffness: 190 },
  soft: { damping: 16, mass: 0.8, stiffness: 120 },
} as const;

// motionIntensity scales amplitude, not duration — "subtle" keeps the same
// rhythm with smaller gestures.
export const intensityScale = (intensity: "punchy" | "subtle") =>
  intensity === "punchy" ? 1 : 0.55;
