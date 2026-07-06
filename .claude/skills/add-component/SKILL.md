---
name: add-component
description: Scaffold a new MOTN AI graphic component end-to-end — Remotion component, zod props schema, planner prompt snippet, and fixture — so the AI planner can start using it. Use when asked to add a new motion-graphics component/visual/animation type to the library.
---

# Add a graphic component to MOTN AI

A new component is one PR touching four places. The planner gains it via one
enum value + a prompt line — nothing else in the pipeline changes.

## Steps

1. **Props schema** — `packages/schema/src/edit-plan.ts`:
   - Add an entry to `GraphicPropsSchemas` (props must be fully describable by
     an LLM: strings, numbers, word-index triggers; length caps on all text).
   - Add a `graphicVariant("<name>")` line to `GraphicSchema`.
   - Timing fields are ALWAYS word indices named `triggerWordIndex` — never
     ms/seconds. Assets are ALWAYS `assets[]` queries resolved offline.

2. **Component** — `packages/video/src/components/<Name>.tsx`:
   - Pure function of `useCurrentFrame()` — no wall clock, no randomness, no
     network, no `<motion.*>` (ESLint enforces this).
   - Import every color/size/easing/spring from `../lib/tokens` — never
     hardcode. Use `useScene()` for words/intensity/theme and
     `useLocalTrigger(wordIndex, fps)` for speech sync.
   - Accept `variant: GraphicVariant` ("overlay" over the speaker, "panel" in
     a split, "full" for animation-full) and keep overlay text legible
     (text-shadow) — see `StatCounter.tsx` for the pattern.
   - On flex containers with `em` gaps, set `fontSize` to the word size or
     words will visually concatenate.

3. **Wire it** — `packages/video/src/layouts/GraphicHost.tsx`: add the switch
   case.

4. **Teach the planner** — `packages/pipeline/src/llm/prompts/plan.md`: add
   one line under TASTE GUARDRAILS saying when to use it (and when not to).
   Bump the frontmatter `version:`. If the mock planner should exercise it,
   extend `packages/pipeline/src/stages/mock-plan.ts`.

5. **Fixture + verify** — add a scene using it to
   `packages/video/src/fixtures/sample.ts`, then:
   - `pnpm studio` to eyeball it, or
   - `pnpm motn run all eval/fixtures/demo.mp4 --force` and inspect
     `data/projects/<id>/renders/smoke/*.png`.
   - `pnpm test && pnpm lint && pnpm typecheck` must pass.
