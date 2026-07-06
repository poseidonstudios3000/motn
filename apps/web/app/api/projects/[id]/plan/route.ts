import fs from "node:fs";
import { EditPlanSchema, TranscriptSchema } from "@motn/schema";
import {
  appendPatch,
  jobExists,
  lintAndSnap,
  projectFile,
  readJson,
  writeJsonAtomic,
} from "@motn/pipeline/lite";
import { kick } from "../../../lib";

export const runtime = "nodejs";

// Raw plan edit from the textarea: validate, re-lint/snap, persist, log the
// PlanPatch, refresh downstream artifacts. Re-edits cost seconds, not credits.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!jobExists(id)) return new Response("not found", { status: 404 });
  const body = (await req.json().catch(() => null)) as {
    plan?: unknown;
    kind?: string;
  } | null;
  if (!body?.plan) return new Response("missing plan", { status: 400 });
  const kind = body.kind === "scene-edit" ? "scene-edit" : "textarea-edit";

  const parsed = EditPlanSchema.safeParse(body.plan);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 10)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n");
    return new Response(`plan failed validation:\n${issues}`, { status: 400 });
  }

  const planFile = projectFile(id, "editplan.json");
  if (!fs.existsSync(planFile)) return new Response("no existing plan", { status: 409 });
  const before = EditPlanSchema.parse(readJson(planFile));
  const transcript = TranscriptSchema.parse(readJson(projectFile(id, "transcript.json")));

  const { plan: after } = lintAndSnap(parsed.data, transcript, parsed.data.source.durationMs);
  writeJsonAtomic(planFile, after);
  appendPatch(id, kind, null, before, after);
  kick("resolve", id, { force: true });
  return Response.json({ ok: true });
}
