import { Composition } from "remotion";
import type { RenderInput } from "@motn/schema";
import { MotnVideo } from "./MotnVideo";
import { sampleRenderInput } from "./fixtures/sample";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="MotnVideo"
    component={MotnVideo as React.FC<Record<string, unknown> & RenderInput>}
    durationInFrames={900}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={sampleRenderInput}
    calculateMetadata={({ props }) => {
      const { durationMs, fps, width, height } = props.plan.source;
      return {
        durationInFrames: Math.max(1, Math.round((durationMs / 1000) * fps)),
        fps,
        width,
        height,
      };
    }}
  />
);
