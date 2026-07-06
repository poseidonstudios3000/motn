import gsap from "gsap";
import { useVideoConfig } from "remotion";
import { FONT, THEME, TYPE } from "../lib/tokens";
import { useScene, useLocalTrigger } from "../lib/SceneContext";
import { useGsapTimeline } from "../lib/useGsapTimeline";
import type { GraphicVariant } from "../layouts/GraphicHost";

// The GSAP showcase component: word-pop kinetic typography synced to the
// spoken trigger word, driven through the paused-timeline seek bridge.
export const KineticText: React.FC<{
  text: string;
  triggerWordIndex: number;
  variant: GraphicVariant;
}> = ({ text, triggerWordIndex }) => {
  const { fps } = useVideoConfig();
  const { theme, intensity } = useScene();
  const t = THEME[theme];
  const triggerFrame = useLocalTrigger(triggerWordIndex, fps);
  const delay = triggerFrame / fps;

  const scopeRef = useGsapTimeline<HTMLDivElement>((el) => {
    const words = el.querySelectorAll(".kword");
    const tl = gsap.timeline();
    tl.set(el, { opacity: 0 });
    tl.set(el, { opacity: 1 }, delay);
    tl.from(
      words,
      {
        opacity: 0,
        yPercent: 130 * intensity,
        rotation: -7 * intensity,
        duration: 0.55,
        stagger: 0.055,
        ease: "back.out(2.2)",
      },
      delay,
    );
    tl.to(
      el.querySelector(".kbar"),
      { scaleX: 1, duration: 0.4, ease: "power3.out" },
      delay + 0.25,
    );
    return tl;
  });

  return (
    <div
      ref={scopeRef}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: "30%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          fontSize: TYPE.h1, // em gap must resolve against the word size
          gap: "0.26em",
          maxWidth: "88%",
        }}
      >
        {text.toUpperCase().split(" ").map((w, i) => (
          <span
            key={i}
            className="kword"
            style={{
              display: "inline-block",
              fontFamily: FONT.family,
              fontWeight: FONT.display,
              fontSize: TYPE.h1,
              lineHeight: 1.05,
              color: i === 0 ? t.accent : t.text,
              textShadow: "0 8px 36px rgba(0,0,0,0.7)",
              letterSpacing: "-0.01em",
            }}
          >
            {w}
          </span>
        ))}
      </div>
      <div
        className="kbar"
        style={{
          marginTop: 26,
          height: 10,
          width: "22%",
          background: t.accent,
          borderRadius: 5,
          transform: "scaleX(0)",
          transformOrigin: "center",
        }}
      />
    </div>
  );
};
