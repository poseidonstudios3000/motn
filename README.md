# MOTN AI

**MOTN AI** (pronounced *Motion A.I.*) turns your raw talking-head video into a viral-style visual edit — AI-planned scene layouts, After-Effects-like motion graphics synced to your speech, and karaoke captions — exported as MP4.

**The pipeline:** upload → transcribe (word-level timestamps + language detection) → AI understands the content → AI plans scenes (full-screen talking head, full-screen animation, or split screen) with speech-synced motion graphics → optional captions (top-center or bottom) → pixel-exact preview → MP4 export at selectable resolution.

**Who it's for:** education, entertainment, and edutainment personal brands — and any brand that wants a clean, intuitive message in videos built to be shared.

**Positioning:** the AI motion designer for your talking head — not another clipper or captioner. It *explains*, it doesn't decorate.

## Status

**Iteration 1 shipped**: the full pipeline runs end-to-end — upload → transcribe → analyze → plan → resolve → pixel-exact preview → MP4 render (720p/1080p, 9:16). Works fully offline in mock mode (no API keys needed) for dev/demo; add keys to switch on the real AI brains.

Read the full product & engineering plan in **[PLAN.md](./PLAN.md)** — stack, pipeline architecture, EditPlan schema, component library, iteration roadmap, costs, and risks.

## Quickstart

```bash
pnpm install                # needs Node 22+, pnpm 10+; ffmpeg on PATH if the
                            # static binaries can't download in your sandbox
cp .env.example .env        # add keys, or leave empty for offline mock mode
pnpm dev                    # web app on http://localhost:3000
```

Upload a 1–15 min talking-head MP4, watch the stages tick, scrub the preview, hit render, download the MP4.

**CLI** (same pipeline, headless):

```bash
pnpm motn run all eval/fixtures/demo.mp4 --res 720p   # full run on the demo fixture
pnpm motn run plan <projectId> --force                # re-run one stage after a prompt tweak
pnpm motn ls                                          # list projects
```

**Remotion Studio** (component development against fixtures):

```bash
pnpm studio
```

**Backends** — each AI stage picks its implementation from env (see `.env.example`):

| Stage | Real | Fallback |
|---|---|---|
| Transcribe | ElevenLabs Scribe v2 (word+char timestamps, 99-lang) | Groq Whisper turbo · offline mock |
| Analyze + Plan | Claude (`claude-opus-4-8`, strict tool use) | deterministic heuristic mock |
| Render | Remotion + local Chromium | — |

The mock backends are deterministic and free — they exist so the edit→preview→render loop can be exercised (and CI'd) with zero keys and zero cost.

## Hosting the UI (Vercel)

The web app deploys to Vercel as a **UI preview only** — set the project's *Root Directory* to `apps/web` (Framework: Next.js, Node 22). The engine (ffmpeg, transcription, AI planning, Chromium rendering, persistent `data/` storage) cannot run in serverless functions, so hosted deploys show a banner instead of the upload form and return 501 from `/api/upload`. The real pipeline runs wherever there's a full machine: your laptop today; a worker box + Remotion Lambda at iteration 4 (see PLAN.md).

## Repo layout

```
packages/schema     zod contracts: Transcript, Analysis, EditPlan, PlanPatch, safe zones
packages/pipeline   stages (ingest→render), STT/LLM adapters, lint/snap, cache, CLI
packages/video      Remotion project: tokens, layouts, 7 components, karaoke captions
apps/web            Next.js: upload → job status → Player preview → render → download
eval/fixtures       demo video generator for offline runs
data/projects       (gitignored) filesystem-as-database artifacts, one dir per project
.claude/skills      /add-component — scaffold a new graphic component end-to-end
```
