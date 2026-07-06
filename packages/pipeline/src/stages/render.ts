import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import { RenderInputSchema, type RenderInput } from "@motn/schema";
import { CACHE_DIR, VIDEO_PKG_DIR, projectDir, projectFile, readJson } from "../paths";
import { serveDir } from "../serve";
import { addRender } from "../jobs";

export type Resolution = "720p" | "1080p";
const SCALES: Record<Resolution, number> = { "720p": 2 / 3, "1080p": 1 };

// ---- browser -------------------------------------------------------------

export const findBrowserExecutable = (): string | null => {
  if (process.env.MOTN_BROWSER_EXECUTABLE) return process.env.MOTN_BROWSER_EXECUTABLE;
  const roots = ["/opt/pw-browsers"];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root).sort().reverse()) {
      for (const rel of [
        "chrome-linux/headless_shell",
        "chrome-linux/chrome",
        "chrome-headless-shell-linux64/chrome-headless-shell",
      ]) {
        const candidate = path.join(root, entry, rel);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }
  return null; // Remotion will download its own headless shell
};

// ---- bundle cache ---------------------------------------------------------

const hashVideoPkg = (): string => {
  const h = crypto.createHash("sha256");
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        const st = fs.statSync(full);
        h.update(`${full}:${st.size}:${st.mtimeMs}`);
      }
    }
  };
  walk(path.join(VIDEO_PKG_DIR, "src"));
  if (fs.existsSync(path.join(VIDEO_PKG_DIR, "public"))) walk(path.join(VIDEO_PKG_DIR, "public"));
  return h.digest("hex").slice(0, 16);
};

export const getServeUrl = async (): Promise<string> => {
  const hash = hashVideoPkg();
  const outDir = path.join(CACHE_DIR, "bundle", hash);
  if (fs.existsSync(path.join(outDir, "index.html"))) return outDir;
  fs.mkdirSync(outDir, { recursive: true });
  return bundle({
    entryPoint: path.join(VIDEO_PKG_DIR, "src", "index.ts"),
    outDir,
    publicDir: path.join(VIDEO_PKG_DIR, "public"),
  });
};

// ---- render ---------------------------------------------------------------

const loadRenderInput = (projectId: string): RenderInput =>
  RenderInputSchema.parse(readJson(projectFile(projectId, "resolved.json")));

export const runRender = async (
  projectId: string,
  resolution: Resolution = "1080p",
): Promise<string> => {
  const input = loadRenderInput(projectId);
  const serveUrl = await getServeUrl();
  const media = await serveDir(projectDir(projectId));
  const browserExecutable = findBrowserExecutable();
  const started = Date.now();
  try {
    const inputProps = { ...input, videoSrc: `${media.url}/proxy.mp4` };
    const composition = await selectComposition({
      serveUrl,
      id: "MotnVideo",
      inputProps,
      browserExecutable: browserExecutable ?? undefined,
    });

    // Frame-sample smoke pass: render one still at every scene boundary and
    // midpoint BEFORE committing minutes of Chromium time to a full render.
    // Catches blank frames, font races, and lint escapes in seconds.
    await smokePass(projectId, serveUrl, composition, inputProps, browserExecutable);

    const outDir = projectFile(projectId, "renders");
    fs.mkdirSync(outDir, { recursive: true });
    const outputLocation = path.join(outDir, `final-${resolution}.mp4`);
    await renderMedia({
      serveUrl,
      composition,
      codec: "h264",
      audioCodec: "aac",
      outputLocation,
      inputProps,
      scale: SCALES[resolution],
      browserExecutable: browserExecutable ?? undefined,
      onProgress: () => {},
    });
    addRender(projectId, {
      file: path.basename(outputLocation),
      resolution,
      at: new Date().toISOString(),
      ms: Date.now() - started,
    });
    return outputLocation;
  } finally {
    media.close();
  }
};

const smokePass = async (
  projectId: string,
  serveUrl: string,
  composition: Awaited<ReturnType<typeof selectComposition>>,
  inputProps: Record<string, unknown>,
  browserExecutable: string | null,
) => {
  const input = loadRenderInput(projectId);
  const fps = input.plan.source.fps;
  const frames = new Set<number>();
  for (const sc of input.plan.scenes) {
    if (sc.startMs === null || sc.endMs === null) continue;
    frames.add(Math.min(composition.durationInFrames - 1, Math.round((sc.startMs / 1000) * fps) + 1));
    frames.add(
      Math.min(
        composition.durationInFrames - 1,
        Math.round((((sc.startMs + sc.endMs) / 2) / 1000) * fps),
      ),
    );
  }
  const sample = [...frames].sort((a, b) => a - b).slice(0, 16);
  const smokeDir = projectFile(projectId, path.join("renders", "smoke"));
  fs.mkdirSync(smokeDir, { recursive: true });
  const browser = await openBrowser("chrome", {
    browserExecutable: browserExecutable ?? undefined,
  });
  try {
    for (const frame of sample) {
      const output = path.join(smokeDir, `f${String(frame).padStart(6, "0")}.png`);
      await renderStill({
        serveUrl,
        composition,
        frame,
        output,
        inputProps,
        puppeteerInstance: browser,
        browserExecutable: browserExecutable ?? undefined,
      });
      const size = fs.statSync(output).size;
      if (size < 1500) {
        throw new Error(
          `Smoke pass: frame ${frame} rendered suspiciously empty (${size} bytes) — aborting before full render`,
        );
      }
    }
  } finally {
    await browser.close({ silent: true });
  }
};
