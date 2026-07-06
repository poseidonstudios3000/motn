import { jobExists, regenerateScene } from "@motn/pipeline/lite";
import { runCli } from "../../../lib";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!jobExists(id)) return new Response("not found", { status: 404 });
  const body = (await req.json().catch(() => null)) as { sceneId?: string } | null;
  if (!body?.sceneId) return new Response("missing sceneId", { status: 400 });
  try {
    await regenerateScene(id, body.sceneId);
    await runCli("resolve", id, { force: true });
    return Response.json({ ok: true });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : String(err), { status: 500 });
  }
}
