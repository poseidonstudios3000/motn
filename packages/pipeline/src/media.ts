import fs from "node:fs";
import { createRequire } from "node:module";
import { execa } from "execa";

// Prefer the vendored static binaries (hermetic clone-and-run), fall back to
// system ffmpeg — the static packages are optional because their postinstall
// download is blocked in some sandboxed environments.
const require = createRequire(import.meta.url);

const resolveBin = (loader: () => string | undefined, system: string): string => {
  try {
    const p = loader();
    if (p && fs.existsSync(p)) return p;
  } catch {
    // optional dep absent — use system binary
  }
  return system;
};

const ffmpegPath = resolveBin(
  () => require("ffmpeg-static") as string,
  "ffmpeg",
);
const ffprobePath = resolveBin(
  () => (require("ffprobe-static") as { path: string }).path,
  "ffprobe",
);

export type Probe = {
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  rotation: number;
};

export const probeVideo = async (file: string): Promise<Probe> => {
  const { stdout } = await execa(ffprobePath, [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    file,
  ]);
  const info = JSON.parse(stdout) as {
    format: { duration?: string };
    streams: Array<{
      codec_type: string;
      width?: number;
      height?: number;
      r_frame_rate?: string;
      side_data_list?: Array<{ rotation?: number }>;
      tags?: { rotate?: string };
    }>;
  };
  const v = info.streams.find((s) => s.codec_type === "video");
  if (!v || !v.width || !v.height) throw new Error("No video stream found in upload");
  const [num, den] = (v.r_frame_rate ?? "30/1").split("/").map(Number);
  const rotation =
    v.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ??
    Number(v.tags?.rotate ?? 0);
  return {
    durationMs: Math.round(Number(info.format.duration ?? 0) * 1000),
    width: v.width,
    height: v.height,
    fps: den ? num! / den : 30,
    hasAudio: info.streams.some((s) => s.codec_type === "audio"),
    rotation: Math.abs(rotation % 360),
  };
};

// CFR H.264/AAC proxy: VFR phone footage is the classic desync source, and a
// constant frame rate makes all downstream frame math exact. Sources without
// audio get a silent track so the rest of the pipeline has one shape.
export const makeProxy = async (src: string, dest: string, fps: number, hasAudio: boolean) => {
  const args = ["-y", "-i", src];
  if (!hasAudio) {
    args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=mono:sample_rate=48000");
  }
  args.push(
    "-map", "0:v:0",
    "-map", hasAudio ? "0:a:0" : "1:a:0",
    "-vf", `fps=${fps},format=yuv420p`,
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "18",
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "48000",
    "-movflags", "+faststart",
  );
  if (!hasAudio) args.push("-shortest");
  args.push(dest);
  await execa(ffmpegPath, args);
};

// 16 kHz mono FLAC: what both STT vendors want, and small enough to dodge
// upload caps.
export const extractAudio = async (src: string, dest: string) => {
  await execa(ffmpegPath, ["-y", "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "flac", dest]);
};

export { ffmpegPath, ffprobePath };
