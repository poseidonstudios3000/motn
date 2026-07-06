import type { Scene } from "@motn/schema";

export type Rect = { x: number; y: number; w: number; h: number; opacity: number };

// The talking-head footage is ONE continuous layer whose rect morphs at
// scene boundaries — the footage never cuts, so speech can never desync.
export const videoRectFor = (scene: Scene, W: number, H: number): Rect => {
  switch (scene.layout) {
    case "talking-head-full":
      return { x: 0, y: 0, w: W, h: H, opacity: 1 };
    case "animation-full":
      // Same footprint, faded out — morphs read as a dissolve, audio continues.
      return { x: 0, y: 0, w: W, h: H, opacity: 0 };
    case "split": {
      const { side, ratio } = scene.splitConfig ?? { side: "top" as const, ratio: 0.5 };
      if (side === "top") return { x: 0, y: 0, w: W, h: H * ratio, opacity: 1 };
      if (side === "left") return { x: 0, y: 0, w: W * ratio, h: H, opacity: 1 };
      return { x: W * (1 - ratio), y: 0, w: W * ratio, h: H, opacity: 1 };
    }
  }
};

export const graphicRectFor = (scene: Scene, W: number, H: number): Rect => {
  if (scene.layout !== "split") return { x: 0, y: 0, w: W, h: H, opacity: 1 };
  const { side, ratio } = scene.splitConfig ?? { side: "top" as const, ratio: 0.5 };
  if (side === "top") return { x: 0, y: H * ratio, w: W, h: H * (1 - ratio), opacity: 1 };
  if (side === "left") return { x: W * ratio, y: 0, w: W * (1 - ratio), h: H, opacity: 1 };
  return { x: 0, y: 0, w: W * (1 - ratio), h: H, opacity: 1 };
};

export const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  w: a.w + (b.w - a.w) * t,
  h: a.h + (b.h - a.h) * t,
  opacity: a.opacity + (b.opacity - a.opacity) * t,
});
