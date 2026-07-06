import { useMemo } from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Scene } from "@motn/schema";
import { EASE, SPACE, SPRINGS } from "../lib/tokens";
import { lerpRect, videoRectFor } from "./layout";

const MORPH_FRAMES = 12;

export type TimedScene = { sc: Scene; startF: number; endF: number };

export const VideoLayer: React.FC<{
  scenes: TimedScene[];
  videoSrc: string;
  intensity: number;
}> = ({ scenes, videoSrc, intensity }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();

  const src = useMemo(
    () =>
      videoSrc.startsWith("http") || videoSrc.startsWith("/")
        ? videoSrc
        : staticFile(videoSrc),
    [videoSrc],
  );

  const found = scenes.findIndex((s) => frame >= s.startF && frame < s.endF);
  const idx = found === -1 ? scenes.length - 1 : found;
  const current = scenes[idx]!;
  const target = videoRectFor(current.sc, W, H);

  // Morph the footage rect across the scene boundary (unless it's a hard cut).
  let rect = target;
  const prev = scenes[idx - 1];
  if (prev && current.sc.transitionIn !== "cut") {
    const t = interpolate(frame - current.startF, [0, MORPH_FRAMES], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE.glide,
    });
    rect = lerpRect(videoRectFor(prev.sc, W, H), target, t);
  }

  // In-scene camera move on the speaker.
  const local = frame - current.startF;
  const zoomKind = current.sc.talkingHead?.zoom ?? "none";
  const sceneLen = current.endF - current.startF;
  let zoom = 1;
  if (zoomKind === "slow-in") {
    zoom = interpolate(local, [0, sceneLen], [1, 1 + 0.07 * intensity]);
  } else if (zoomKind === "punch-in") {
    const s = spring({ frame: local, fps, config: SPRINGS.punch, durationInFrames: 18 });
    zoom = 1 + 0.13 * intensity * s;
  }

  const isFull = rect.w >= W - 1 && rect.h >= H - 1;

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          overflow: "hidden",
          opacity: rect.opacity,
          borderRadius: isFull ? 0 : SPACE.radiusSmall,
        }}
      >
        <OffthreadVideo
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${zoom})`,
            transformOrigin: "50% 38%",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
