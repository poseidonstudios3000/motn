import { projectFile } from "@motn/pipeline/lite";
import { streamFile } from "../../../../lib";

export const runtime = "nodejs";

const ALLOWED = new Set(["proxy.mp4", "source.mp4"]);

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; file: string }> },
) {
  const { id, file } = await ctx.params;
  if (!ALLOWED.has(file)) return new Response("forbidden", { status: 403 });
  return streamFile(projectFile(id, file), "video/mp4", req.headers.get("range"));
}
