import { execFile, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { REPO_ROOT } from "@motn/pipeline/lite";

// Heavy pipeline stages run OUT OF PROCESS via the CLI: the Next server never
// loads @remotion/bundler/renderer (native binaries webpack can't ingest),
// and a crashed render can't take the dev server down. Progress and errors
// land in job.json (stageWrap), which the UI polls.

const TSX = path.join(REPO_ROOT, "node_modules", ".bin", "tsx");
const CLI = path.join(REPO_ROOT, "packages", "pipeline", "src", "cli.ts");

const running = new Set<string>();

const cliArgs = (
  stages: string,
  projectId: string,
  opts: { force?: boolean; resolution?: string } = {},
) => [
  CLI,
  "run",
  stages,
  projectId,
  ...(opts.force ? ["--force"] : []),
  ...(opts.resolution ? ["--res", opts.resolution] : []),
];

// Fire-and-forget (upload kick, render): detached child, UI polls job.json.
export const kick = (
  stages: string,
  projectId: string,
  opts: { force?: boolean; resolution?: string } = {},
) => {
  const key = `${projectId}:${stages}`;
  if (running.has(key)) return;
  running.add(key);
  const child = spawn(TSX, cliArgs(stages, projectId, opts), {
    cwd: REPO_ROOT,
    stdio: "ignore",
    detached: true,
  });
  child.on("exit", () => running.delete(key));
  child.on("error", () => running.delete(key));
  child.unref();
};

// Awaited variant for routes that respond after the work is done.
export const runCli = (
  stages: string,
  projectId: string,
  opts: { force?: boolean; resolution?: string } = {},
): Promise<void> =>
  new Promise((resolve, reject) => {
    execFile(
      TSX,
      cliArgs(stages, projectId, opts),
      { cwd: REPO_ROOT, timeout: 10 * 60 * 1000 },
      (err, _stdout, stderr) =>
        err ? reject(new Error(stderr.slice(-500) || err.message)) : resolve(),
    );
  });

export const streamFile = (
  file: string,
  contentType: string,
  rangeHeader?: string | null,
  download?: string,
): Response => {
  if (!fs.existsSync(file)) return new Response("not found", { status: 404 });
  const size = fs.statSync(file).size;
  const common: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    ...(download ? { "Content-Disposition": `attachment; filename="${download}"` } : {}),
  };
  const m = rangeHeader?.match(/bytes=(\d*)-(\d*)/);
  if (m) {
    const start = m[1] ? parseInt(m[1], 10) : 0;
    const end = m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1;
    const stream = Readable.toWeb(
      fs.createReadStream(file, { start, end }),
    ) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: {
        ...common,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }
  const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
  return new Response(stream, {
    status: 200,
    headers: { ...common, "Content-Length": String(size) },
  });
};
