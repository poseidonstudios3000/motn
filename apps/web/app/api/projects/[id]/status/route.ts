import { jobExists, readJob } from "@motn/pipeline/lite";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!jobExists(id)) return new Response("not found", { status: 404 });
  return Response.json(readJob(id));
}
