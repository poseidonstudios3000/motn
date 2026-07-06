import { createProjectFromBuffer } from "@motn/pipeline/lite";
import { kick } from "../lib";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return new Response("no file", { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const id = createProjectFromBuffer(buf, file.name);
  kick("preview", id);
  return Response.json({ id });
}
