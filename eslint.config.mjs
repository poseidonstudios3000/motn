import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "data/**",
      "**/.remotion/**",
      "apps/web/next-env.d.ts",
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Determinism house rules for the render path: every pixel must derive
    // from useCurrentFrame(). Wall-clock time, randomness, timers, and network
    // are banned inside packages/video.
    files: ["packages/video/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "Date", property: "now", message: "Render path must be deterministic — derive from useCurrentFrame()." },
        { object: "Math", property: "random", message: "Use Remotion's random(seed) instead." },
        { object: "window", property: "setTimeout", message: "Timers break frame determinism." },
        { object: "window", property: "setInterval", message: "Timers break frame determinism." },
      ],
      "no-restricted-globals": [
        "error",
        { name: "setTimeout", message: "Timers break frame determinism." },
        { name: "setInterval", message: "Timers break frame determinism." },
        { name: "requestAnimationFrame", message: "Animate by seeking from useCurrentFrame(), not rAF." },
        { name: "fetch", message: "No network at render time — bundle all assets." },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: "new Date() is wall-clock — render path must be deterministic.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "motion", message: "motion.dev is wall-clock driven — app UI chrome only, never the render path." },
            { name: "framer-motion", message: "Wall-clock driven — never the render path." },
          ],
        },
      ],
    },
  },
);
