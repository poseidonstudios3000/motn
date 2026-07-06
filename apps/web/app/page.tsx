import { listProjects, readJob } from "@motn/pipeline/lite";
import { STAGES } from "@motn/schema";
import { UploadForm } from "./upload-form";

export const dynamic = "force-dynamic";

export default function Home() {
  const projects = listProjects().map((id) => {
    const job = readJob(id);
    const done = Object.values(job.stages).filter((s) => s.status === "done").length;
    const error = Object.values(job.stages).find((s) => s.status === "error");
    return { id, name: job.sourceName, done, error: Boolean(error), createdAt: job.createdAt };
  });

  return (
    <div>
      <h1>Turn a talking head into a viral edit</h1>
      <div className="card">
        <UploadForm />
      </div>

      <h2>Projects</h2>
      {projects.length === 0 ? (
        <p className="dim">No projects yet — upload a video to start.</p>
      ) : (
        projects.map((p) => (
          <a className="project-link" key={p.id} href={`/project/${p.id}`}>
            <span>{p.name}</span>
            <span className="dim">
              {p.error ? "error" : `${p.done}/${STAGES.length} stages`} ·{" "}
              {new Date(p.createdAt).toLocaleString()}
            </span>
          </a>
        ))
      )}
    </div>
  );
}
