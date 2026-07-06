"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Player } from "@remotion/player";
import { MotnVideo } from "@motn/video/MotnVideo";
import type { EditPlan, Job, RenderInput } from "@motn/schema";
import { STAGES } from "@motn/schema";
import { SceneEditor } from "./scene-editor";

const POLL_MS = 1500;

export function ProjectView({ id }: { id: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [input, setInput] = useState<RenderInput | null>(null);
  const [planText, setPlanText] = useState("");
  const [planDirty, setPlanDirty] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refreshArtifacts = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/artifact/resolved.json`);
    if (res.ok) {
      const data = (await res.json()) as RenderInput;
      setInput(data);
      if (!planDirty) setPlanText(JSON.stringify(data.plan, null, 2));
    }
  }, [id, planDirty]);

  useEffect(() => {
    let stop = false;
    let lastStamp = "";
    const tick = async () => {
      if (stop) return;
      try {
        const res = await fetch(`/api/projects/${id}/status`);
        if (res.ok) {
          const j = (await res.json()) as Job;
          setJob(j);
          const stamp = JSON.stringify(j.stages);
          if (stamp !== lastStamp && j.stages.resolve?.status === "done") {
            lastStamp = stamp;
            await refreshArtifacts();
          }
        }
      } catch {
        // transient poll failure — keep polling
      }
      setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [id, refreshArtifacts]);

  const post = async (path: string, body?: unknown) => {
    setMsg(null);
    const res = await fetch(`/api/projects/${id}/${path}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) setMsg(await res.text());
    return res.ok;
  };

  const applyPlan = async () => {
    try {
      const parsed = JSON.parse(planText) as unknown;
      if (await post("plan", { plan: parsed })) {
        setPlanDirty(false);
        setMsg("Plan applied — preview updates in a moment.");
      }
    } catch (err) {
      setMsg(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Structured edits apply immediately: the server re-lints/snaps, logs a
  // PlanPatch, re-resolves, and the polling loop refreshes the preview.
  const [editBusy, setEditBusy] = useState(false);
  const applySceneEdit = async (next: EditPlan) => {
    setEditBusy(true);
    try {
      if (await post("plan", { plan: next, kind: "scene-edit" })) {
        await refreshArtifacts();
        setMsg("Edit applied.");
      }
    } finally {
      setEditBusy(false);
    }
  };

  const regenerateScene = async (sceneId: string) => {
    setEditBusy(true);
    try {
      if (await post("regenerate", { sceneId })) {
        await refreshArtifacts();
        setMsg(`Scene ${sceneId} regenerated.`);
      }
    } finally {
      setEditBusy(false);
    }
  };

  const rendering = job?.stages.render?.status === "running";
  const captions = input?.plan.captions;

  const playerProps = useMemo(() => {
    if (!input) return null;
    return {
      ...input,
      videoSrc: `/api/projects/${id}/media/proxy.mp4`,
    };
  }, [input, id]);

  return (
    <div>
      <h1 className="row">
        <span>{job?.sourceName ?? id}</span>
        <span className="dim">{id}</span>
      </h1>

      <div className="stage-list" style={{ marginBottom: 20 }}>
        {STAGES.map((s) => {
          const st = job?.stages[s];
          return (
            <span key={s} className={`stage ${st?.status ?? ""}`}>
              {s}
              {st?.note ? ` · ${st.note}` : ""}
              {st?.costUsd ? ` · $${st.costUsd.toFixed(3)}` : ""}
            </span>
          );
        })}
      </div>

      {Object.entries(job?.stages ?? {})
        .filter(([, st]) => st.status === "error")
        .map(([name, st]) => (
          <p key={name} className="error-text">
            {name} failed: {st.error}
          </p>
        ))}

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div className="card" style={{ width: 360 }}>
          {playerProps ? (
            <Player
              component={MotnVideo}
              inputProps={playerProps}
              durationInFrames={Math.max(
                1,
                Math.round(
                  (playerProps.plan.source.durationMs / 1000) * playerProps.plan.source.fps,
                ),
              )}
              fps={playerProps.plan.source.fps}
              compositionWidth={playerProps.plan.source.width}
              compositionHeight={playerProps.plan.source.height}
              controls
              style={{ width: 320, height: 569 }}
            />
          ) : (
            <p className="dim">Preview appears when the pipeline reaches “resolve”…</p>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 420 }}>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Captions</h2>
            <div className="row">
              <label className="check">
                <input
                  type="checkbox"
                  checked={captions?.enabled ?? true}
                  onChange={(e) =>
                    post("prefs", { captions: { enabled: e.target.checked } })
                  }
                />
                enabled
              </label>
              <select
                value={captions?.position ?? "bottom"}
                onChange={(e) => post("prefs", { captions: { position: e.target.value } })}
              >
                <option value="bottom">bottom</option>
                <option value="top-center">top-center</option>
              </select>
            </div>

            <h2>Scenes</h2>
            {input ? (
              <SceneEditor
                plan={input.plan}
                busy={editBusy}
                onApply={applySceneEdit}
                onRegenerate={regenerateScene}
              />
            ) : (
              <p className="dim">Scene editor appears once the plan is ready…</p>
            )}

            <h2>Render</h2>
            <div className="row">
              {(["720p", "1080p"] as const).map((res) => (
                <button
                  key={res}
                  className="btn"
                  disabled={rendering || !input}
                  onClick={() => post("render", { resolution: res })}
                >
                  {rendering ? "Rendering…" : `Render ${res}`}
                </button>
              ))}
              {job?.renders.map((r) => (
                <a
                  key={r.file}
                  className="btn secondary"
                  href={`/api/projects/${id}/download/${r.file}`}
                >
                  ⬇ {r.file} ({(r.ms / 1000).toFixed(0)}s)
                </a>
              ))}
            </div>

            <details style={{ marginTop: 18 }}>
              <summary className="dim" style={{ cursor: "pointer" }}>
                Advanced: raw edit plan (JSON)
              </summary>
              <textarea
                className="plan"
                style={{ marginTop: 10 }}
                value={planText}
                onChange={(e) => {
                  setPlanText(e.target.value);
                  setPlanDirty(true);
                }}
              />
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn" onClick={applyPlan} disabled={!planDirty}>
                  Apply JSON
                </button>
              </div>
            </details>
            <div className="row" style={{ marginTop: 14 }}>
              <button
                className="btn secondary"
                onClick={async () => {
                  if (await post("run", { stage: "plan", force: true })) {
                    setPlanDirty(false);
                    setMsg("Re-planning…");
                  }
                }}
              >
                Re-plan from scratch
              </button>
              {msg ? <span className="dim">{msg}</span> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
