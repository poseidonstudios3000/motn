import "./env";
import fs from "node:fs";
import { STAGES, type StageName } from "@motn/schema";
import { createProject, listProjects } from "./projects";
import { runAll, runStage, runToPreview, type RunOptions } from "./run";
import { readJob, jobExists } from "./jobs";
import { sttBackend, llmBackend } from "./env";

const usage = `MOTN AI pipeline

Usage:
  motn new <video.mp4>                 create a project from a video file
  motn run all <projectId|video.mp4>   run the full pipeline (creates project for a path)
  motn run <stage> <projectId>         run one stage (${STAGES.join(", ")})
  motn ls                              list projects
  motn status <projectId>              show job status

Options:
  --res 720p|1080p    render resolution (default 1080p)
  --force             ignore stage cache
`;

const main = async () => {
  const args = process.argv.slice(2);
  const opts: RunOptions = {
    resolution: args.includes("--res")
      ? (args[args.indexOf("--res") + 1] as RunOptions["resolution"])
      : "1080p",
    force: args.includes("--force"),
  };
  const positional = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--res");
  const [cmd, a, b] = positional;

  if (cmd === "new" && a) {
    const id = createProject(a);
    console.log(id);
    return;
  }
  if (cmd === "ls") {
    for (const id of listProjects()) {
      const job = readJob(id);
      const done = Object.values(job.stages).filter((s) => s.status === "done").length;
      console.log(`${id}  ${job.sourceName}  ${done}/${STAGES.length} stages done`);
    }
    return;
  }
  if (cmd === "status" && a) {
    console.log(JSON.stringify(readJob(a), null, 2));
    return;
  }
  if (cmd === "run" && a && b) {
    let projectId = b;
    if (!jobExists(b) && fs.existsSync(b)) {
      projectId = createProject(b);
      console.log(`project: ${projectId}`);
    }
    console.log(`backends: stt=${sttBackend()} llm=${llmBackend()}`);
    if (a === "all") {
      await runAll(projectId, opts);
    } else if (a === "preview") {
      // everything except render — what the web UI kicks off on upload
      await runToPreview(projectId, opts);
    } else {
      // one stage, or a comma-chain like "plan,resolve"
      const stages = a.split(",");
      for (const s of stages) {
        if (!(STAGES as readonly string[]).includes(s)) {
          console.error(`Unknown stage: ${s}\n${usage}`);
          process.exit(1);
        }
      }
      for (const s of stages) await runStage(projectId, s as StageName, opts);
    }
    console.log(JSON.stringify(readJob(projectId).stages, null, 2));
    return;
  }
  console.log(usage);
};

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
