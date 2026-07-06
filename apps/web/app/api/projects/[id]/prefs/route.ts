import fs from "node:fs";
import { EditPlanSchema } from "@motn/schema";
import {
  appendPatch,
  jobExists,
  projectFile,
  readJson,
  writeJsonAtomic,
} from "@motn/pipeline/lite";
import { kick } from "../../../lib";

export const runtime = "nodejs";

// Caption preferences. Applied two ways: persisted to prefs.json (so future
// re-plans respect them) and patched directly into the current plan (so the
// preview updates without an LLM round-trip).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!jobExists(id)) return new Response("not found", { status: 404 });
  const body = (await req.json().catch(() => null)) as {
    captions?: { enabled?: boolean; position?: "top-center" | "bottom" };
  } | null;
  if (!body?.captions) return new Response("missing captions prefs", { status: 400 });

  const prefsFile = projectFile(id, "prefs.json");
  const prev = fs.existsSync(prefsFile)
    ? readJson<Record<string, unknown>>(prefsFile)
    : {};
  const prefs = {
    ...prev,
    captions: { ...(prev.captions as object | undefined), ...body.captions },
  };
  writeJsonAtomic(prefsFile, prefs);

  const planFile = projectFile(id, "editplan.json");
  if (fs.existsSync(planFile)) {
    const before = EditPlanSchema.parse(readJson(planFile));
    const after = {
      ...before,
      captions: {
        ...before.captions,
        ...(body.captions.enabled !== undefined ? { enabled: body.captions.enabled } : {}),
        ...(body.captions.position !== undefined ? { position: body.captions.position } : {}),
      },
    };
    writeJsonAtomic(planFile, after);
    appendPatch(
      id,
      body.captions.position !== undefined ? "caption-position" : "caption-toggle",
      null,
      before,
      after,
    );
    kick("resolve", id, { force: true });
  }
  return Response.json({ ok: true });
}
