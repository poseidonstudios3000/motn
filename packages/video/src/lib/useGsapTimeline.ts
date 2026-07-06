import gsap from "gsap";
import { useLayoutEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

// The GSAP↔Remotion determinism bridge: build a PAUSED timeline once, then
// seek it to the current frame on every render. useCurrentFrame() stays the
// only clock — same frame, same pixels, in the Player and in the renderer.
export const useGsapTimeline = <T extends HTMLElement>(
  build: (scopeEl: T) => gsap.core.Timeline,
) => {
  const scopeRef = useRef<T>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  useLayoutEffect(() => {
    if (!scopeRef.current) return;
    const ctx = gsap.context(() => {
      tlRef.current = build(scopeRef.current!);
      tlRef.current.pause();
    }, scopeRef);
    return () => {
      ctx.revert();
      tlRef.current = null;
    };
    // build runs once on mount by design — the timeline is then only seeked
  }, []);  

  useLayoutEffect(() => {
    tlRef.current?.seek(frame / fps, false);
  }, [frame, fps]);

  return scopeRef;
};
