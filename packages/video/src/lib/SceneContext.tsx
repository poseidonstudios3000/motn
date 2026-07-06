import { createContext, useContext } from "react";
import type { WordTime } from "./timing";
import type { ThemeName } from "./tokens";

// Everything a graphic component needs to sync to speech, provided once at
// the scene level so component props stay exactly the EditPlan props.
export type SceneCtx = {
  words: WordTime[];
  sceneStartFrame: number; // absolute comp frame where this scene begins
  sceneDurationFrames: number;
  intensity: number; // amplitude multiplier from style.motionIntensity
  theme: ThemeName;
  captionsBottom: boolean; // bottom caption slot in use → panels keep clear of it
};

const Ctx = createContext<SceneCtx | null>(null);

export const SceneProvider = Ctx.Provider;

export const useScene = (): SceneCtx => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useScene outside SceneProvider");
  return v;
};

// A trigger word's frame RELATIVE to the scene sequence (sequences reset
// useCurrentFrame to 0 at the scene start).
export const useLocalTrigger = (wordIndex: number, fps: number): number => {
  const { words, sceneStartFrame } = useScene();
  const w = words[Math.min(wordIndex, words.length - 1)];
  const abs = w ? Math.round((w.startMs / 1000) * fps) : 0;
  return Math.max(0, abs - sceneStartFrame);
};
