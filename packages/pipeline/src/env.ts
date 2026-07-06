import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./paths";

// Minimal .env loader (root .env, no dependency). Real env always wins.
const envFile = path.join(REPO_ROOT, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] && process.env[m[1]] === undefined && m[2] !== "") {
      process.env[m[1]] = m[2];
    }
  }
}

export type SttBackend = "scribe" | "groq" | "mock";
export type LlmBackend = "anthropic" | "mock";

export const sttBackend = (): SttBackend => {
  const explicit = process.env.MOTN_STT as SttBackend | undefined;
  if (explicit) return explicit;
  if (process.env.ELEVENLABS_API_KEY) return "scribe";
  if (process.env.GROQ_API_KEY) return "groq";
  return "mock";
};

export const llmBackend = (): LlmBackend => {
  const explicit = process.env.MOTN_LLM as LlmBackend | undefined;
  if (explicit) return explicit;
  return process.env.ANTHROPIC_API_KEY ? "anthropic" : "mock";
};

export const llmModel = () => process.env.MOTN_MODEL ?? "claude-opus-4-8";
