import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { EASE, SPRINGS } from "./tokens";

export const msToFrame = (ms: number, fps: number) => Math.round((ms / 1000) * fps);

export type WordTime = { i: number; text: string; startMs: number; endMs: number };

// Frame at which a word lands — the sync point for triggered animations.
export const wordFrame = (words: WordTime[], wordIndex: number, fps: number): number => {
  const w = words[Math.min(wordIndex, words.length - 1)];
  return w ? msToFrame(w.startMs, fps) : 0;
};

// Progress of a triggered pop: 0 before the trigger, springs to 1 after.
export const useTriggerSpring = (
  triggerFrame: number,
  config: keyof typeof SPRINGS = "punch",
): number => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame: frame - triggerFrame,
    fps,
    config: SPRINGS[config],
    durationInFrames: 40,
  });
};

// Enter/exit envelope for a graphic living inside a scene-length Sequence.
// Returns opacity/translate/scale for the whole panel.
export const useEnterExit = (
  durationInFrames: number,
  enter: "pop" | "fade" | "slide-up" | "wipe",
  exit: "fade" | "slide-down" | "pop-out",
  intensity: number,
): { opacity: number; transform: string } => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enterLen = Math.min(14, Math.floor(durationInFrames / 3));
  const exitLen = Math.min(10, Math.floor(durationInFrames / 4));
  const outStart = durationInFrames - exitLen;

  const eIn = spring({ frame, fps, config: SPRINGS.punch, durationInFrames: enterLen * 2 });
  const linIn = interpolate(frame, [0, enterLen], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.snap,
  });
  const out = interpolate(frame, [outStart, durationInFrames - 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.in,
  });

  let opacity = 1;
  let transform = "none";
  if (enter === "fade") opacity = linIn;
  else if (enter === "pop") {
    opacity = linIn;
    transform = `scale(${0.82 + 0.18 * eIn})`;
  } else if (enter === "slide-up") {
    opacity = linIn;
    transform = `translateY(${(1 - eIn) * 90 * intensity}px)`;
  } else if (enter === "wipe") {
    opacity = linIn;
    transform = `translateX(${(1 - eIn) * -70 * intensity}px)`;
  }

  if (exit === "fade") opacity *= out;
  else if (exit === "slide-down") {
    opacity *= out;
    if (frame >= outStart) transform = `translateY(${(1 - out) * 70 * intensity}px)`;
  } else if (exit === "pop-out") {
    opacity *= out;
    if (frame >= outStart) transform = `scale(${1 - (1 - out) * 0.12})`;
  }
  return { opacity, transform };
};
