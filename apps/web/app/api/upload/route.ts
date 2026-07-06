import { createProjectFromBuffer } from "@motn/pipeline/lite";
import { engineAvailable, kick } from "../lib";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!engineAvailable()) {
    return new Response(
      "This hosted deployment is a UI preview only — the MOTN engine (ffmpeg, transcription, Chromium rendering) runs where there's a real machine: clone the repo and `pnpm dev`. A hosted pipeline is on the roadmap (iteration 4).",
      { status: 501 },
    );
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return new Response("no file", { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const id = createProjectFromBuffer(buf, file.name);
  kick("preview", id);
  return Response.json({ id });
}
