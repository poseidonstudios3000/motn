import type { NextConfig } from "next";

// Routes import only @motn/pipeline/lite (fs/JSON helpers — no native deps);
// heavy stages run out-of-process via the pipeline CLI. That keeps the server
// bundle free of @remotion/bundler's native binaries entirely.
const config: NextConfig = {
  transpilePackages: ["@motn/schema", "@motn/video", "@motn/pipeline"],
};

export default config;
