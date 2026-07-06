import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { llmModel } from "../env";

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

// $/MTok — used for job.json cost tracking. Unknown models cost null.
const PRICES: Record<string, { in: number; out: number }> = {
  "claude-opus-4-8": { in: 5, out: 25 },
  "claude-sonnet-5": { in: 3, out: 15 },
  "claude-haiku-4-5-20251001": { in: 1, out: 5 },
};

export type LlmResult<T> = { value: T; costUsd: number | null };

// One structured call: the model is forced to answer through a single tool
// whose input schema is the zod schema. The static system prompt gets a
// cache_control breakpoint (the component catalog barely changes between
// calls — caching cuts the bulk of input cost).
export const structuredCall = async <S extends z.ZodTypeAny>(opts: {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  schema: S;
  maxTokens?: number;
  // Prior turns for lint-retry round-trips:
  priorMessages?: Anthropic.MessageParam[];
}): Promise<LlmResult<z.infer<S>> & { messages: Anthropic.MessageParam[] }> => {
  const model = llmModel();
  const jsonSchema = zodToJsonSchema(opts.schema, { $refStrategy: "none" }) as Record<
    string,
    unknown
  >;
  delete jsonSchema.$schema;

  const messages: Anthropic.MessageParam[] = [
    ...(opts.priorMessages ?? []),
    { role: "user", content: opts.user },
  ];

  const res = await getClient().messages.create({
    model,
    max_tokens: opts.maxTokens ?? 16000,
    system: [
      {
        type: "text",
        text: opts.system,
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        name: opts.toolName,
        description: opts.toolDescription,
        input_schema: jsonSchema as Anthropic.Tool["input_schema"],
      },
    ],
    tool_choice: { type: "tool", name: opts.toolName },
    messages,
  });

  const toolUse = res.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) throw new Error("Model did not return a tool_use block");

  const parsed = opts.schema.safeParse(toolUse.input);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 12)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    const err = new Error(`Schema validation failed: ${issues}`);
    (err as Error & { retryable?: boolean }).retryable = true;
    throw err;
  }

  const price = PRICES[model];
  const costUsd = price
    ? (res.usage.input_tokens / 1e6) * price.in + (res.usage.output_tokens / 1e6) * price.out
    : null;

  return {
    value: parsed.data,
    costUsd,
    messages: [...messages, { role: "assistant", content: res.content }],
  };
};

// Transcript rendered as indexed words — the only timing vocabulary the LLM
// is allowed to use. LLMs are unreliable at float arithmetic; a deterministic
// post-processor owns index→ms.
export const indexedTranscript = (words: Array<{ i: number; text: string }>): string =>
  words.map((w) => `${w.i}:${w.text}`).join(" ");
