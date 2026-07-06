# MOTN AI — Product & Engineering Plan

**MOTN AI** (pronounced *Motion A.I.*) turns a raw talking-head video into a viral-style visual edit: AI-planned scene layouts, After-Effects-like motion graphics synced to speech, and karaoke captions — exported as MP4.

**Positioning:** *the AI motion designer for your talking head* — not another clipper or captioner. The market (Opus Clip, Submagic, Captions.app, Klap, Vizard) is saturated on clipping, captions, b-roll, and zooms. Verified gap: nobody ships **automatic, speech-synced, content-aware explanatory motion graphics** with AI-planned per-scene layouts. That is the product.

**Target audience:** education / entertainment / edutainment personal brands and brands that want clean, intuitive, shareable messaging.

**Core values:** fast iteration loops, constant evolution, automation + AI wherever it genuinely works best.

---

## 1. Product principles

1. **Explains, not decorates.** Post-MrBeast-backlash, the 2026 meta is one meaningful visual beat every 20–30 seconds that aids comprehension. The scene planner enforces a **graphics budget**, it does not maximize effect density. This is both the quality bar and the marketing copy.
2. **Everything is editable after generation, and re-edits are cheap.** Forced full regeneration is the #1 hated failure mode across competitors. Every pipeline stage is replayable in isolation; editing the plan never re-transcribes; regenerating one scene never touches the others.
3. **What you preview is exactly what renders.** Pixel parity between the scrubbing preview and the final MP4 — no "render surprise."
4. **The AI decides *what and when*; the component library decides *how it moves*.** Craft lives in hand-built, token-driven components. The LLM arranges them. This is how output stays polished while the tool evolves weekly.
5. **Speed is a feature.** Competitors have 30–45 min render queues and slow feedback loops. Our whole pipeline is built around seconds-fast re-runs.

---

## 2. How the pipeline works

```
upload → 1 ingest → 2 transcribe → 3 analyze → 4 plan → 5 lint+resolve → 6 preview → 7 render
```

| # | Stage | What it does |
|---|-------|--------------|
| 1 | **ingest** | ffprobe metadata; transcode upload to a CFR H.264/AAC proxy (VFR phone footage is the classic desync source); extract 16 kHz mono FLAC for STT. MVP caps input at 15 min. |
| 2 | **transcribe** | Word-level-timestamped transcript + automatic language detection via a vendor-agnostic `Transcriber` adapter (see §4). |
| 3 | **analyze** | Claude pass 1: topic, tone, content type, outline beats, key claims, stats/numeric entities, list-structure candidates, hook line, emphasis-word candidates — all timed by **word indices**, never seconds. |
| 4 | **plan** | Claude pass 2 (strict tool use): emits the constrained **EditPlan** JSON (§6) — scene segmentation, layout per scene, which graphic component with which props, caption emphasis. Pacing rules live in the system prompt (scenes 2–8 s, one visual idea per scene, emphasis ≤8% of words, graphics budget 1 beat / 20–30 s). |
| 5 | **lint + snap + resolve** | Pure TypeScript, no LLM unless retrying: validates timeline coverage & non-overlap, snaps scene cuts to inter-word gaps (never mid-word), converts word indices → ms, resolves icon queries against the bundled icon set. Lint failures round-trip to the LLM with the error list (max 3 retries, cheap-model-first); terminal fallback is a **captions-only plan** — never a blocked render. |
| 6 | **preview** | `@remotion/player` in the web app mounts the *identical* composition the renderer uses. Includes a **frame-sample smoke pass**: headlessly render one still at every scene boundary/midpoint before any full render — catches blank frames, font races, and lint escapes in seconds instead of minutes. |
| 7 | **render** | `renderMedia()` server-side → H.264 MP4 + AAC, resolution picker (720p/1080p at MVP) via render-time scale. Original speech track muxed sample-accurately from the proxy. |

Every stage is a **pure, replayable function `(inputs on disk) → artifact on disk`**, cached by `sha256(inputs) + STAGE_VERSION`. Change the plan prompt → `motn run plan <id>` → preview updates in seconds without re-transcribing. Artifacts are diffable JSON: comparing two edit plans across prompt versions is `git diff`.

```
data/projects/<projectId>/
├─ source.mp4          # raw upload
├─ probe.json          # ffprobe: fps, duration, w×h, rotation, audio codec
├─ proxy.mp4           # CFR H.264/AAC yuv420p faststart (seek-safe)
├─ audio.flac          # 16 kHz mono → STT
├─ transcript.json     # normalized, vendor-agnostic
├─ analysis.json       # Claude pass 1 (+ provenance)
├─ editplan.json       # Claude pass 2, post-lint (+ provenance)
├─ editplan.raw.json   # pre-lint LLM output, kept for debugging
├─ resolved.json       # EditPlan + concrete asset paths
├─ patches.jsonl       # every human edit as a structured PlanPatch record
├─ job.json            # stage statuses, timings, costs, errors
└─ renders/final-1080.mp4
```

---

## 3. Stack (verified mid-2026)

| Layer | Choice | Notes |
|---|---|---|
| Runtime / language | Node 22 LTS, TypeScript strict | One language end-to-end, one `pnpm dev`. |
| Monorepo | pnpm workspaces | |
| Video framework | **Remotion 4.0.x** (pinned — do *not* auto-upgrade to v5; license terms change) | `@remotion/player`, `@remotion/renderer`, `@remotion/media`, `@remotion/captions`, `@remotion/zod-types`, `@remotion/transitions`. |
| Motion engine | **GSAP 3.15** (fully free incl. SplitText/MorphSVG/DrawSVG since Apr 2025) | Driven *only* via the paused-timeline `seek(frame/fps)` bridge (§5). `interpolate()`/`spring()` for simple moves. |
| Schemas | zod (`@remotion/zod-types` pins zod 3) | |
| Web app | Next.js 15 App Router, React 18 | Upload UI, Player preview, render trigger. `motion` (motion.dev) allowed for app UI chrome only — never in the render path. |
| Transcription | **ElevenLabs Scribe v2** primary + **Groq `whisper-large-v3-turbo`** fallback | Behind one adapter (§4). |
| LLM | **Anthropic API, `claude-opus-4-8`** | `messages.parse()` + zod for pass 1; strict tool use for the EditPlan; prompt caching on the static component-catalog system prompt (~90% input-cost cut). Haiku for cheap lint-repair retries. |
| Media processing | `ffmpeg-static` + `ffprobe-static` via `execa`; `mediabunny` for metadata in `calculateMetadata` | No system ffmpeg dependency → clone-and-run works. |
| Icons / emoji | `lucide-static` (~1,500 ISC icons) + Twemoji SVGs, bundled; `fuse.js` fuzzy resolver | Zero network at render time. |
| Testing | vitest + `lint-plan` invariant suite | Eval harness lands in iteration 2 (§8). |

**Explicitly rejected** (all verified): Theatre.js (dormant since May 2024), Motion Canvas / Revideo (stale, no headless CLI), Rive (proprietary-editor authoring can't be AI-generated per video), raw Lottie JSON generation (schema-fragile), OpenAI gpt-4o-transcribe family (no word timestamps), Gemini for STT (segment-level timestamps only), runtime code-gen (§5), Shotstack-style JSON-to-video render clouds (no moat), HyperFrames as foundation (Apache-2.0 and promising, but pre-1.0 — kept as a monitored hedge, §10).

---

## 4. Transcription & language detection

**Primary: ElevenLabs Scribe v2** ($0.22/hr ≈ $0.037 per 10-min video):
- Word- **and character**-level timestamps (character-level unlocks per-letter karaoke/typography later),
- Best-in-class automatic language detection across 99 languages **including mid-file code-switching**,
- Audio event tags (laughter, music, applause) — free triggers for the motion-graphics planner,
- Diarization included.

**Fallback / draft mode: Groq `whisper-large-v3-turbo`** (~220× real-time; a 10-min video transcribes in ~3–5 s for ~$0.007) — perfect for dev loops, instant re-runs, and vendor-outage fallback. Word timestamps via the OpenAI-compatible API (`verbose_json` + `timestamp_granularities`).

Both normalize into one internal schema; character timestamps and audio events are optional fields so the Groq path degrades gracefully. Everything downstream consumes only this schema:

```jsonc
// transcript.json
{
  "schemaVersion": 1,
  "language": "en",                       // BCP-47, auto-detected
  "provider": "scribe-v2",
  "words":    [ { "i": 0, "text": "Hey", "startMs": 120, "endMs": 300, "confidence": 0.98, "chars": null } ],
  "segments": [ { "startWord": 0, "endWord": 14, "text": "..." } ],
  "events":   [ { "type": "laughter", "startMs": 41200, "endMs": 42100 } ]   // optional
}
```

Skipped: OpenAI's API entirely (its best models lack word timestamps; whisper-1 is dominated by Groq on price/speed for the same model). Deferred: self-hosting (WhisperX / Voxtral open weights) until volume makes $0.22/hr matter — the adapter keeps that door open.

---

## 5. Rendering & motion: determinism is structural

**Remotion's `useCurrentFrame()` is the only clock.** GSAP integrates via the officially documented bridge — build a paused timeline once, then seek it to the current frame:

```tsx
// packages/video/src/lib/useGsapTimeline.ts
export const useGsapTimeline = (build: () => gsap.core.Timeline) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ref = useRef<gsap.core.Timeline>();
  useEffect(() => { ref.current = build(); ref.current.pause(); return () => ref.current?.kill(); }, []);
  useEffect(() => { ref.current?.seek(frame / fps); }, [frame, fps]);
};
```

House rules enforced by ESLint on `packages/video`: banned `Date.now`, `Math.random` (use Remotion's `random(seed)`), un-seeked rAF, `setTimeout`, `<motion.*>`, network `fetch`. Fonts via `staticFile()` + `delayRender()`; all icons/emoji bundled. **Same frame → same pixels** — locally, in the Player, and later across parallel Lambda chunks.

**Why schema-driven components, not runtime code-gen.** The LLM emits a constrained JSON EditPlan rendered by a vetted component library — never runtime code. Every shipping competitor is template/parameter-driven; Remotion's own AI guidance recommends exactly this split for pipelines; and runtime code-gen costs the three things we optimize for: determinism, render reliability, and loop speed. Code-gen happens at **dev time** instead: Claude Code (with Remotion Agent Skills + GSAP skills) authors new components as PRs — that's how the tool "constantly evolves" without runtime nondeterminism. A new component = component + zod props schema + prompt snippet + fixture, and the planner gains it by one enum value.

**Design-token layer (built in week 1, *under* the components).** One named easing/spring set (`ease.snap`, `ease.glide`, `spring.punch`), one modular type scale, one spacing/safe-zone grid — every component must import from it. This is the single cheapest lever for making AI-assembled scenes feel like *one editor cut this video* rather than seven demos stapled together, and it makes theme #2 and the 16:9 format pure data changes.

**Layout modes** are three components switched per scene, with `@remotion/transitions` between layout changes:
- `TalkingHeadFull` — absolute-fill `<Video>` + optional slow punch-in zoom,
- `AnimationFull` — full-screen graphic canvas, talking-head audio continues,
- `Split` — flex row/column, configurable side + ratio.

**Captions**: `KaraokeCaptions` on `@remotion/captions` (`createTikTokStyleCaptions()`), optional, two presets (`punchy` Hormozi-ish / `editorial` restrained), keyword emphasis + emoji inserts, two **safe-zone slots** — top-center (below the ~108 px platform UI band) and bottom (lower-middle third, ≥370 px above frame bottom). Safe zones live in versioned config, not constants — platforms shifted them three times in the last 12 months.

**Component library v1 (the seven):**

| Component | What it is |
|---|---|
| `kineticText` | SplitText word-pop keyword callouts — the signature kinetic typography |
| `statCounter` | Animated number count-up — the edutainment stat moment |
| `listReveal` | Step/checklist build-up synced to word indices |
| `iconRow` | 2–4 icons + labels popping in sequence |
| `hookTitle` | First-3-seconds massive title card |
| `quoteCard` | Pull-quote treatment |
| `lowerThird` | Name/context introduction |

---

## 6. The EditPlan schema (v1)

The contract between the AI brain and the renderer. Deliberately **engine-agnostic** (word indices + component names + props, no Remotion types) — the escape hatch if we ever swap render engines.

```jsonc
// editplan.json
{
  "schemaVersion": 1,
  "language": "en",
  "provenance": { "promptVersion": "plan@3", "model": "claude-opus-4-8", "schemaVersion": 1 },
  "source": { "durationMs": 312000, "fps": 30, "width": 1080, "height": 1920 },
  "style": { "theme": "editorial-dark", "motionIntensity": "punchy" },       // or "subtle"
  "captions": {
    "enabled": true,
    "position": "top-center",                       // or "bottom"
    "preset": "punchy",                             // or "editorial"
    "emphases":     [ { "wordIndex": 42, "effect": "color" } ],   // color | scale | underline
    "emojiInserts": [ { "afterWordIndex": 87, "emoji": "🔥" } ]
  },
  "scenes": [ {
    "id": "s3",
    "startWordIndex": 118, "endWordIndex": 167,     // LLM speaks in word indices…
    "startMs": 41250, "endMs": 55020,               // …lint/snap stage owns index → ms
    "layout": "split",                              // talking-head-full | animation-full | split
    "splitConfig": { "side": "left", "ratio": 0.5 },          // null unless split
    "talkingHead": { "zoom": "punch-in" },                    // none | slow-in | punch-in
    "transitionIn": "slide",                                  // cut | fade | slide | wipe
    "graphic": {                                    // discriminated union on `component`, or null
      "component": "statCounter",
      "props": { "value": 73, "suffix": "%", "label": "of viewers watch muted",
                 "triggerWordIndex": 131 },
      "assets": [ { "kind": "icon", "query": "volume-off", "resolvedPath": null } ],
      "enter": "pop", "exit": "fade"
    },
    "rationale": "stat moment — count-up reinforces the claim"  // stripped pre-render, kept for evals
  } ]
}
```

Key decisions baked into the schema:
- **All LLM timing is word indices, never seconds** — LLMs are unreliable at float arithmetic; a deterministic post-processor owns index→ms conversion and snaps cuts to inter-word gaps.
- Strict-tool-use compatible: `additionalProperties: false` everywhere, optionality as `| null`, per-component props as a discriminated union.
- Asset `query`, not asset path: a deterministic resolver (fuzzy match over bundled Lucide) picks the file — LLMs hallucinate icon names; fallback is a text chip.
- `schemaVersion` + `provenance` on every artifact so old projects replay after schema evolution and every output is attributable to a prompt version.

**The flywheel plumbing ships in week 1** even though nothing consumes it yet (impossible to collect retroactively):
- Prompts are versioned files with frontmatter (`packages/pipeline/src/llm/prompts/`),
- `analysis.json`/`editplan.json` carry `promptVersion` / `model` / `schemaVersion` provenance,
- Every human edit (textarea diff, scene regenerate, caption toggle) is logged as a structured **PlanPatch** record to `patches.jsonl`.

This is the correction corpus that later powers evals, prompt A/B attribution ("patch-rate per component per promptVersion"), and eventually fine-tuned taste.

---

## 7. Repo structure

```
motn/
├─ package.json            # workspaces; scripts: dev, motn, studio, test, lint
├─ pnpm-workspace.yaml
├─ .env.example            # ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, GROQ_API_KEY, MOTN_STT
├─ packages/
│  ├─ schema/              # zod: transcript.ts, analysis.ts, edit-plan.ts, safe-zones.ts
│  ├─ pipeline/
│  │  ├─ src/stages/       # ingest.ts, transcribe/{scribe,groq,adapter}.ts,
│  │  │                    # analyze.ts, plan.ts, lint.ts, snap.ts, assets/resolve.ts
│  │  ├─ src/llm/          # prompts/ (versioned .md with frontmatter), client.ts
│  │  ├─ src/cache.ts      # content-hash + STAGE_VERSION memoization
│  │  ├─ src/jobs.ts       # in-process promise queue + job.json status
│  │  └─ src/cli.ts        # `motn run <stage|all> <projectId|videoPath>`
│  └─ video/               # the Remotion project
│     ├─ src/Root.tsx      # <Composition> registrations
│     ├─ src/MotnVideo.tsx # top comp: maps EditPlan.scenes → <Sequence>
│     ├─ src/layouts/      # TalkingHeadFull, AnimationFull, Split
│     ├─ src/components/   # KineticText, StatCounter, ListReveal, IconRow, HookTitle, QuoteCard, LowerThird
│     ├─ src/captions/     # KaraokeCaptions + presets
│     ├─ src/lib/          # useGsapTimeline.ts, tokens.ts (easing/type/spacing), theme.ts
│     └─ public/           # fonts/, icons/ (lucide), emoji/ (twemoji)
├─ apps/web/               # Next.js 15: upload → job status → <Player> preview → render → download
├─ eval/                   # golden transcripts + fixtures (grows in iteration 2)
├─ data/projects/          # gitignored artifacts
└─ .claude/skills/         # dev-time: /add-component skill, Remotion + GSAP agent skills
```

**Dev loop:** `pnpm dev` → web app on :3000. `pnpm studio` → Remotion Studio for component work against fixture EditPlans. `pnpm motn run all fixtures/demo.mp4` → full headless pipeline for CI and prompt iteration. **`/add-component`** (a Claude Code skill) scaffolds component + zod props + prompt snippet + fixture in one PR — the product's stated evolution mechanic, made a one-command operation.

---

## 8. Iteration roadmap

### Iteration 1 — the end-to-end demo (~2 weeks)

**The demo:** upload a 1–10 min talking-head video → get back a 9:16 MP4 with AI-planned layouts, speech-synced motion graphics, and karaoke captions — previewable pixel-exactly before render.

In scope:
- Full 7-stage pipeline, web UI **and** CLI, one `pnpm dev`
- Transcription adapter with both vendors, auto language detection, word timestamps
- Claude two-pass analyze→plan with lint/snap/retry loop and captions-only terminal fallback
- All 3 layout modes + transitions + punch-in zoom
- The 7 components on the design-token layer; one polished theme; `punchy`/`subtle` intensity
- Optional captions, top-center or bottom, two presets, emphasis + emoji, safe-zone config
- Player scrub preview + frame-sample smoke pass + MP4 export at 720p/1080p (9:16, 1080×1920)
- First edit affordances: raw `editplan.json` textarea + **per-scene "regenerate this scene"** (re-runs pass 2 on one word range with neighbor scenes as context — directly attacks the forced-full-regeneration failure mode)
- Provenance + PlanPatch logging; determinism ESLint ruleset; per-stage cost tracking in `job.json`

Explicitly deferred: auth/multi-tenancy/billing/hosting (single local user is enough to learn if output quality lands) · Lambda/queue/Postgres/S3 (local render of a 5-min video is minutes — fine for validation) · 16:9, 1:1, 4K (layout system is aspect-agnostic by construction; only 9:16 is tested) · diagram archetypes (needs the eval harness first or it ships embarrassing output) · image-gen b-roll, SFX, audio-event triggers · structured plan-editor UI · eval harness (iteration 2, with a hard rule attached).

### Iteration 2 — quality loop & editability (the *learn* machinery)
- **Eval harness before the second prompt rewrite, not after**: ~20 golden transcripts; invariant assertions (coverage, scene density, emphasis ratio, graphics budget) in CI via the Batch API; rendered stills at scene midpoints → checklist-based VLM judge (evidence frames, not naive "rate this"); edit-density metrics per prompt version (fed by PlanPatch data).
- **Zero-cost re-edits**: structured per-scene property panel (layout, component, props, word-snapped timings) replacing the JSON textarea.
- Second style theme (`editorial` as first-class peer of `punchy`); SFX pack fired on graphic-enter events.
- Groq draft-mode toggle in the UI ("fast preview plan," ~$0.01).

### Iteration 3 — the moat: explanatory graphics + second format
- **Diagram archetypes** (template-constrained, never freeform): comparison A-vs-B, cause→effect, cycle, checklist — the LLM picks the archetype and fills slots. This is the verified market gap.
- Micro-charts: animated bar/line from LLM-emitted data arrays (never image-gen numbers).
- Asset pipeline v2: AI image-gen stills with fixed per-theme style suffix; self-hosted Iconify for long-tail icons.
- **16:9 @ 1920×1080** — the YouTube edutainment segment pays $50–200/finished-minute and every 9:16-only clip tool ignores it; mostly config thanks to the token/slot system.
- Scribe audio-event triggers (laughter → emoji burst).

### Iteration 4 — productization & scale
- Auth, Postgres + Drizzle (job/user state), S3/R2 media storage, pg-boss job queue (no Redis to operate).
- **Remotion Lambda** behind the same render interface (verified: 10-min HD ≈ 56 s / ~$0.10); request AWS concurrency quota early.
- 4K paid tier; progress streaming; transparent per-video/per-minute pricing (credit-burn opacity is the #1 competitor grievance); fast renders as a *marketed* feature.
- Remotion **Automators license** ($0.01/render, $100/mo min) budgeted the moment headcount hits 4 — v5 terms count contractors.

### Iteration 5 — differentiation & hedges
- Chat-based plan editing ("make the stats punchier") → mutations of the same EditPlan via the iter-2 editor's operations.
- Brand kits: user fonts/palettes/logo as theme parameters; groundwork for a component marketplace (components as data + prompt snippets).
- **HyperFrames re-evaluation** (Apache-2.0, zero render fees): if matured past 1.0, an `EditPlan → HTML/GSAP` renderer behind the same schema as a license-cost hedge.
- `@remotion/web-renderer` (if stabilized) for free in-browser draft exports; multilingual polish (RTL captions, CJK line-breaking); WhisperX/Voxtral self-host path if STT volume cost ever matters.

---

## 9. Costs (verified, per 10-min video)

| Item | Cost |
|---|---|
| Transcription — Scribe v2 | $0.037 (Groq draft mode: $0.007) |
| LLM — Opus 4.8, two passes, cached system prompt | ~$0.10–0.30 |
| Render — local | $0 (later Lambda: ~$0.10) |
| **Total COGS** | **< $0.50** |

Pricing headroom is not the constraint; iteration speed is.

---

## 10. Risks & hedges

| Risk | Mitigation |
|---|---|
| **Remotion is source-available, not OSS** — free ≤3 people, then $100/mo min; v5 counts contractors and bills client-side renders; can't fork. | Pin 4.x; budget the license as COGS from day one; EditPlan stays engine-agnostic; HyperFrames (Apache-2.0) monitored as the swap candidate. |
| **GSAP license Webflow-competition gray zone** — MP4 output reads as Permitted Use, but MOTN *is* a no-code animation tool. | Thin `useGsapTimeline` bridge so MIT-licensed anime.js v4 (`.seek()` + manual ticking) is a drop-in fallback; get written confirmation from Webflow before public launch. |
| **Vendor STT dependence** — char timestamps & audio events are Scribe-only; Whisper timestamps drift near silences/music. | Adapter with optional fields; Groq fallback from a different vendor; snap cuts to word gaps, never mid-word; self-host path (WhisperX/Voxtral) kept open. |
| **Schema-driven plans cap peak expressiveness** — novel visual ideas wait for a dev-time component PR. | Accepted: every shipping competitor is template-driven; `/add-component` skill makes the vocabulary grow weekly; dev-time code-gen keeps craft without runtime nondeterminism. |
| **No eval harness at MVP** — first prompt version is judged by eyeball. | Hard rule: the harness lands *before* the second prompt iteration. PlanPatch + provenance data collection starts week 1 so evals have data on arrival. |
| **Single-box, filesystem-as-DB MVP** — no concurrency or multi-tenant story. | Deliberate: the MVP's job is to learn whether output quality lands. The stage interface is the seam where Postgres/S3/queue/Lambda slot in at iteration 4 without touching stage logic. |

---

## 11. Definition of done — iteration 1

Record a 3-minute talking-head clip, run `pnpm dev`, upload it, watch stages complete, scrub the preview, hit render, and get a 1080×1920 MP4 where:
1. Captions are word-synced with sensible emphasis, in the chosen slot, in the detected language.
2. At least 3 of the 7 components fire at content-appropriate moments (a stat gets a `statCounter`, a list gets a `listReveal`, the hook gets a `hookTitle`).
3. Layout changes (full ↔ split ↔ full-graphic) land on natural speech boundaries with clean transitions.
4. The render matches the preview frame-for-frame.
5. Editing one scene in the plan and re-rendering costs seconds of pipeline time, not a full re-run.
