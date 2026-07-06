// The web-safe surface of the pipeline: pure fs/JSON helpers, schema-driven
// lint, and patch logging — nothing that drags in @remotion/bundler,
// @remotion/renderer, execa, or other native/heavy deps. API routes import
// THIS entry; heavy stages run out-of-process via the CLI (see apps/web
// app/api/lib.ts). Keeps the Next server bundle clean and the dev server
// isolated from render crashes.
export * from "./paths";
export * from "./jobs";
export * from "./projects";
export * from "./patches";
export * from "./regenerate";
export * from "./env";
export { lintAndSnap, captionsOnlyPlan } from "./stages/lint";
