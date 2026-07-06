import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import Fuse from "fuse.js";
import { EditPlanSchema, RenderInputSchema, type EditPlan, type RenderInput, type Transcript } from "@motn/schema";
import { projectFile, readJson, writeJsonAtomic } from "../paths";

const require = createRequire(import.meta.url);

// Bundled Lucide icons resolved by fuzzy match — the LLM emits a query like
// "volume-off", never a filename (LLMs hallucinate icon names). A miss means
// the component renders a text chip instead; renders never touch the network.
let fuse: Fuse<string> | null = null;
let iconsDir = "";

const getFuse = (): Fuse<string> => {
  if (fuse) return fuse;
  iconsDir = path.join(path.dirname(require.resolve("lucide-static/package.json")), "icons");
  const names = fs
    .readdirSync(iconsDir)
    .filter((f) => f.endsWith(".svg"))
    .map((f) => f.replace(/\.svg$/, ""));
  fuse = new Fuse(names, { includeScore: true, threshold: 0.45 });
  return fuse;
};

export const resolveIcon = (query: string): { name: string; svg: string } | null => {
  const hits = getFuse().search(query.toLowerCase().trim().replace(/\s+/g, "-"));
  const best = hits[0];
  if (!best) return null;
  const svg = fs.readFileSync(path.join(iconsDir, `${best.item}.svg`), "utf8");
  return { name: best.item, svg };
};

// Square flag SVGs from flag-icons, looked up by ISO2 code. A miss degrades
// to a lettermark chip in the component — never a broken render.
export const resolveFlag = (query: string): { name: string; svg: string } | null => {
  const code = query.toLowerCase().trim().slice(0, 2);
  if (!/^[a-z]{2}$/.test(code)) return null;
  try {
    const flagsDir = path.join(
      path.dirname(require.resolve("flag-icons/package.json")),
      "flags",
      "1x1",
    );
    const file = path.join(flagsDir, `${code}.svg`);
    if (!fs.existsSync(file)) return null;
    return { name: code, svg: fs.readFileSync(file, "utf8") };
  } catch {
    return null;
  }
};

export const runResolve = async (projectId: string): Promise<RenderInput> => {
  const plan = EditPlanSchema.parse(
    readJson<EditPlan>(projectFile(projectId, "editplan.json")),
  );
  const transcript = readJson<Transcript>(projectFile(projectId, "transcript.json"));

  const resolvedPlan: EditPlan = {
    ...plan,
    scenes: plan.scenes.map((sc) => {
      if (!sc.graphic || sc.graphic.assets.length === 0) return sc;
      return {
        ...sc,
        graphic: {
          ...sc.graphic,
          assets: sc.graphic.assets.map((a) => {
            if (a.kind === "emoji") return a;
            const hit = a.kind === "flag" ? resolveFlag(a.query) : resolveIcon(a.query);
            return {
              ...a,
              resolvedName: hit?.name ?? null,
              resolvedSvg: hit?.svg ?? null,
            };
          }),
        },
      };
    }),
  };

  const renderInput: RenderInput = {
    plan: resolvedPlan,
    words: transcript.words.map((w) => ({
      i: w.i,
      text: w.text,
      startMs: w.startMs,
      endMs: w.endMs,
    })),
    // Placeholder token: each consumer maps it to a URL it can actually
    // fetch (web: /api/projects/<id>/media/proxy.mp4; render: local server).
    videoSrc: "proxy.mp4",
  };
  writeJsonAtomic(
    projectFile(projectId, "resolved.json"),
    RenderInputSchema.parse(renderInput),
  );
  return renderInput;
};
