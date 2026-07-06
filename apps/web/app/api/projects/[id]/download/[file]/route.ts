import path from "node:path";
import { projectFile, readJob } from "@motn/pipeline/lite";
import { streamFile } from "../../../../lib";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; file: string }> },
) {
  const { id, file } = await ctx.params;
  if (!/^final-(720p|1080p)\.mp4$/.test(file)) {
    return new Response("forbidden", { status: 403 });
  }
  const source = readJob(id).sourceName.replace(/\.[^.]+$/, "");
  return streamFile(
    projectFile(id, path.join("renders", file)),
    "video/mp4",
    req.headers.get("range"),
    `${source}-motn-${file}`,
  );
}
