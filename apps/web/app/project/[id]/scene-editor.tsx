"use client";

import type { EditPlan, Scene } from "@motn/schema";

// Structured per-scene editing: every dropdown change applies immediately
// (the server re-lints, re-snaps, logs a PlanPatch, and re-resolves — a
// re-edit costs seconds, never a regeneration).

const LAYOUTS = ["talking-head-full", "animation-full", "split"] as const;
const ZOOMS = ["none", "slow-in", "punch-in"] as const;
const TRANSITIONS = ["cut", "fade", "slide", "wipe"] as const;
const SIDES = ["top", "left", "right"] as const;
const RATIOS = [0.4, 0.45, 0.5, 0.55, 0.6];

const fmtS = (ms: number | null) => (ms === null ? "?" : `${(ms / 1000).toFixed(1)}s`);

export function SceneEditor({
  plan,
  busy,
  onApply,
  onRegenerate,
}: {
  plan: EditPlan;
  busy: boolean;
  onApply: (next: EditPlan) => void;
  onRegenerate: (sceneId: string) => void;
}) {
  const patchScene = (idx: number, patch: Partial<Scene>) => {
    const scenes = plan.scenes.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onApply({ ...plan, scenes });
  };

  const setLayout = (idx: number, layout: Scene["layout"]) => {
    const sc = plan.scenes[idx]!;
    patchScene(idx, {
      layout,
      splitConfig:
        layout === "split" ? (sc.splitConfig ?? { side: "top", ratio: 0.45 }) : null,
      talkingHead: layout === "animation-full" ? null : (sc.talkingHead ?? { zoom: "none" }),
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="row" style={{ marginBottom: 4 }}>
        <label className="check">
          motion
          <select
            disabled={busy}
            value={plan.style.motionIntensity}
            onChange={(e) =>
              onApply({
                ...plan,
                style: {
                  ...plan.style,
                  motionIntensity: e.target.value as EditPlan["style"]["motionIntensity"],
                },
              })
            }
          >
            <option value="punchy">punchy</option>
            <option value="subtle">subtle</option>
          </select>
        </label>
        <label className="check">
          caption style
          <select
            disabled={busy}
            value={plan.captions.preset}
            onChange={(e) =>
              onApply({
                ...plan,
                captions: {
                  ...plan.captions,
                  preset: e.target.value as EditPlan["captions"]["preset"],
                },
              })
            }
          >
            <option value="punchy">punchy</option>
            <option value="editorial">editorial</option>
          </select>
        </label>
      </div>

      {plan.scenes.map((sc, idx) => (
        <div className="scene-card" key={sc.id}>
          <div className="scene-head">
            <b>{sc.id}</b>
            <span className="dim">
              {fmtS(sc.startMs)}–{fmtS(sc.endMs)} · words {sc.startWordIndex}–{sc.endWordIndex}
            </span>
            <span className="dim">
              {sc.graphic ? `graphic: ${sc.graphic.component}` : "no graphic"}
            </span>
          </div>
          <div className="row">
            <label className="check">
              layout
              <select
                disabled={busy}
                value={sc.layout}
                onChange={(e) => setLayout(idx, e.target.value as Scene["layout"])}
              >
                {LAYOUTS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {sc.layout === "split" ? (
              <>
                <label className="check">
                  speaker
                  <select
                    disabled={busy}
                    value={sc.splitConfig?.side ?? "top"}
                    onChange={(e) =>
                      patchScene(idx, {
                        splitConfig: {
                          side: e.target.value as NonNullable<Scene["splitConfig"]>["side"],
                          ratio: sc.splitConfig?.ratio ?? 0.45,
                        },
                      })
                    }
                  >
                    {SIDES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="check">
                  ratio
                  <select
                    disabled={busy}
                    value={String(sc.splitConfig?.ratio ?? 0.45)}
                    onChange={(e) =>
                      patchScene(idx, {
                        splitConfig: {
                          side: sc.splitConfig?.side ?? "top",
                          ratio: Number(e.target.value),
                        },
                      })
                    }
                  >
                    {RATIOS.map((r) => (
                      <option key={r} value={String(r)}>
                        {Math.round(r * 100)}%
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
            {sc.layout !== "animation-full" ? (
              <label className="check">
                zoom
                <select
                  disabled={busy}
                  value={sc.talkingHead?.zoom ?? "none"}
                  onChange={(e) =>
                    patchScene(idx, {
                      talkingHead: { zoom: e.target.value as NonNullable<Scene["talkingHead"]>["zoom"] },
                    })
                  }
                >
                  {ZOOMS.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="check">
              cut in
              <select
                disabled={busy}
                value={sc.transitionIn}
                onChange={(e) =>
                  patchScene(idx, { transitionIn: e.target.value as Scene["transitionIn"] })
                }
              >
                {TRANSITIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            {sc.graphic ? (
              <button
                className="btn secondary small"
                disabled={busy}
                onClick={() => patchScene(idx, { graphic: null })}
              >
                remove graphic
              </button>
            ) : null}
            <button
              className="btn secondary small"
              disabled={busy}
              onClick={() => onRegenerate(sc.id)}
            >
              regenerate
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
