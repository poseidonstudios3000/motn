import { STAGES } from "@motn/schema";
import { jobExists } from "@motn/pipeline/lite";
import { kick } from "../../../lib";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!jobExists(id)) return new Response("not found", { status: 404 });
  const body = (await req.json().catch(() => ({}))) as {
    stage?: string;
    force?: boolean;
  };
  if (body.stage) {
    if (!(STAGES as readonly string[]).includes(body.stage)) {
      return new Response(`unknown stage ${body.stage}`, { status: 400 });
    }
    // A re-plan invalidates resolved assets — always chain resolve after.
    kick(body.stage === "plan" ? "plan,resolve" : body.stage, id, { force: body.force });
  } else {
    kick("preview", id, { force: body.force });
  }
  return Response.json({ ok: true });
}
