import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import type { RenderInput } from "@motn/schema";
import { FONT, THEME, intensityScale } from "./lib/tokens";
import { msToFrame } from "./lib/timing";
import { ensureFonts } from "./lib/fonts";
import { SceneProvider } from "./lib/SceneContext";
import { VideoLayer, type TimedScene } from "./layouts/VideoLayer";
import { GraphicHost } from "./layouts/GraphicHost";
import { KaraokeCaptions } from "./captions/KaraokeCaptions";

// The composition. Layer order: continuous footage → per-scene graphics →
// captions. The Player previews exactly this tree; the renderer renders
// exactly this tree — that parity is the point.
export const MotnVideo: React.FC<RenderInput> = ({ plan, words, videoSrc }) => {
  ensureFonts();
  const { fps } = useVideoConfig();
  const theme = THEME[plan.style.theme];
  const intensity = intensityScale(plan.style.motionIntensity);

  const scenes: TimedScene[] = plan.scenes.map((sc) => ({
    sc,
    startF: msToFrame(sc.startMs ?? 0, fps),
    endF: msToFrame(sc.endMs ?? 0, fps),
  }));

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, fontFamily: FONT.family }}>
      <style>{`.motn-icon svg{width:100%;height:100%;stroke-width:1.75}`}</style>
      <VideoLayer scenes={scenes} videoSrc={videoSrc} intensity={intensity} />
      {scenes.map(({ sc, startF, endF }) =>
        sc.graphic ? (
          <Sequence
            key={sc.id}
            from={startF}
            durationInFrames={Math.max(1, endF - startF)}
            name={`scene-${sc.id}-${sc.graphic.component}`}
          >
            <SceneProvider
              value={{
                words,
                sceneStartFrame: startF,
                sceneDurationFrames: Math.max(1, endF - startF),
                intensity,
                theme: plan.style.theme,
                captionsBottom:
                  plan.captions.enabled && plan.captions.position === "bottom",
              }}
            >
              <GraphicHost scene={sc} />
            </SceneProvider>
          </Sequence>
        ) : null,
      )}
      {plan.captions.enabled ? (
        <KaraokeCaptions captions={plan.captions} words={words} theme={plan.style.theme} />
      ) : null}
    </AbsoluteFill>
  );
};
