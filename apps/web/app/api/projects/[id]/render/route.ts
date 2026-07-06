import { jobExists } from "@motn/pipeline/lite";
import { kick } from "../../../lib";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!jobExists(id)) return new Response("not found", { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { resolution?: "720p" | "1080p" };
  kick("render", id, { resolution: body.resolution ?? "1080p", force: true });
  return Response.json({ ok: true });
}
