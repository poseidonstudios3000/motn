import { projectFile, writeJsonAtomic } from "../paths";
import { probeVideo, makeProxy, extractAudio, type Probe } from "../media";

export const COMPOSITION_FPS = 30;
export const MAX_INPUT_MINUTES = 15;

export type IngestOutput = Probe & { proxyFps: number };

export const runIngest = async (projectId: string): Promise<IngestOutput> => {
  const source = projectFile(projectId, "source.mp4");
  const probe = await probeVideo(source);
  if (probe.durationMs > MAX_INPUT_MINUTES * 60_000) {
    throw new Error(`Input is ${(probe.durationMs / 60000).toFixed(1)} min — MVP cap is ${MAX_INPUT_MINUTES} min`);
  }
  if (probe.durationMs < 3000) {
    throw new Error("Input is shorter than 3 seconds");
  }
  const proxy = projectFile(projectId, "proxy.mp4");
  await makeProxy(source, proxy, COMPOSITION_FPS, probe.hasAudio);
  await extractAudio(proxy, projectFile(projectId, "audio.flac"));
  // Re-probe the proxy: it is what preview and render actually consume.
  const proxyProbe = await probeVideo(proxy);
  const out: IngestOutput = { ...proxyProbe, proxyFps: COMPOSITION_FPS };
  writeJsonAtomic(projectFile(projectId, "probe.json"), out);
  return out;
};
