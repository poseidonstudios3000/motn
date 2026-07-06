import fs from "node:fs";
import { projectFile } from "@motn/pipeline/lite";

export const runtime = "nodejs";

const ALLOWED = new Set([
  "probe.json",
  "transcript.json",
  "analysis.json",
  "editplan.json",
  "editplan.raw.json",
  "resolved.json",
  "job.json",
]);

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; name: string }> },
) {
  const { id, name } = await ctx.params;
  if (!ALLOWED.has(name)) return new Response("forbidden", { status: 403 });
  const file = projectFile(id, name);
  if (!fs.existsSync(file)) return new Response("not found", { status: 404 });
  return new Response(fs.readFileSync(file), {
    headers: { "Content-Type": "application/json" },
  });
}
