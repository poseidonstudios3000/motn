import { z } from "zod";
import { ProvenanceSchema } from "./provenance";

// The EditPlan is the contract between the AI brain and the renderer.
// Deliberately engine-agnostic: word indices + component names + props.
// The LLM speaks in word indices; the lint/snap stage owns index→ms.

export const AssetSchema = z.object({
  kind: z.enum(["icon", "emoji", "flag"]), // flag: query is an ISO2 country code
  query: z.string().min(1), // e.g. "volume-off" — a deterministic resolver picks the file
  resolvedName: z.string().nullable(), // filled by the resolve stage
  resolvedSvg: z.string().nullable(), // raw SVG markup, inlined so renders are hermetic
});
export type Asset = z.infer<typeof AssetSchema>;

const trigger = z.number().int().nonnegative();

export const GraphicPropsSchemas = {
  hookTitle: z.object({
    title: z.string().min(1).max(60),
    subtitle: z.string().max(80).nullable(),
  }),
  kineticText: z.object({
    text: z.string().min(1).max(48), // short punch phrase, not a paragraph
    triggerWordIndex: trigger,
  }),
  statCounter: z.object({
    value: z.number(),
    prefix: z.string().max(4).nullable(),
    suffix: z.string().max(12).nullable(),
    label: z.string().max(64),
    triggerWordIndex: trigger,
  }),
  listReveal: z.object({
    title: z.string().max(48).nullable(),
    items: z
      .array(z.object({ text: z.string().min(1).max(60), triggerWordIndex: trigger }))
      .min(2)
      .max(5),
  }),
  iconRow: z.object({
    items: z
      .array(
        z.object({
          label: z.string().min(1).max(24),
          assetIndex: z.number().int().nonnegative(), // index into graphic.assets
          triggerWordIndex: trigger,
        }),
      )
      .min(2)
      .max(4),
  }),
  quoteCard: z.object({
    quote: z.string().min(1).max(160),
    attribution: z.string().max(48).nullable(),
    triggerWordIndex: trigger,
  }),
  lowerThird: z.object({
    name: z.string().min(1).max(48),
    subtitle: z.string().max(64).nullable(),
    triggerWordIndex: trigger,
  }),
  // Semantic depiction components — visuals that SHOW what is being said,
  // not just decorate it.
  geoMap: z.object({
    country: z.string().min(2).max(48), // English country name, e.g. "United States"
    label: z.string().min(1).max(24), // short on-screen label, e.g. "USA"
    flagAssetIndex: z.number().int().nonnegative().nullable(), // index into assets, or null
    triggerWordIndex: trigger, // zoom lands as the country is spoken
  }),
  versus: z.object({
    left: z.object({
      label: z.string().min(1).max(20),
      assetIndex: z.number().int().nonnegative(), // flag or icon in assets
      triggerWordIndex: trigger,
    }),
    right: z.object({
      label: z.string().min(1).max(20),
      assetIndex: z.number().int().nonnegative(),
      triggerWordIndex: trigger,
    }),
  }),
} as const;

export type ComponentName = keyof typeof GraphicPropsSchemas;
export const COMPONENT_NAMES = Object.keys(GraphicPropsSchemas) as ComponentName[];

const graphicVariant = <N extends ComponentName>(name: N) =>
  z.object({
    component: z.literal(name),
    props: GraphicPropsSchemas[name],
    assets: z.array(AssetSchema),
    enter: z.enum(["pop", "fade", "slide-up", "wipe"]),
    exit: z.enum(["fade", "slide-down", "pop-out"]),
  });

export const GraphicSchema = z.discriminatedUnion("component", [
  graphicVariant("hookTitle"),
  graphicVariant("kineticText"),
  graphicVariant("statCounter"),
  graphicVariant("listReveal"),
  graphicVariant("iconRow"),
  graphicVariant("quoteCard"),
  graphicVariant("lowerThird"),
  graphicVariant("geoMap"),
  graphicVariant("versus"),
]);
export type Graphic = z.infer<typeof GraphicSchema>;

export const SceneSchema = z.object({
  id: z.string().min(1),
  startWordIndex: z.number().int().nonnegative(),
  endWordIndex: z.number().int().nonnegative(),
  // Filled by the lint/snap stage (index→ms, snapped to inter-word gaps):
  startMs: z.number().int().nonnegative().nullable(),
  endMs: z.number().int().nonnegative().nullable(),
  layout: z.enum(["talking-head-full", "animation-full", "split"]),
  splitConfig: z
    .object({
      side: z.enum(["left", "right", "top"]), // where the talking head sits
      ratio: z.number().min(0.3).max(0.7),
    })
    .nullable(),
  talkingHead: z.object({ zoom: z.enum(["none", "slow-in", "punch-in"]) }).nullable(),
  transitionIn: z.enum(["cut", "fade", "slide", "wipe"]),
  graphic: GraphicSchema.nullable(),
  rationale: z.string(), // the LLM's why — stripped pre-render, kept for evals
});
export type Scene = z.infer<typeof SceneSchema>;

export const CaptionsConfigSchema = z.object({
  enabled: z.boolean(),
  position: z.enum(["top-center", "bottom"]),
  preset: z.enum(["punchy", "editorial"]),
  emphases: z.array(
    z.object({
      wordIndex: z.number().int().nonnegative(),
      effect: z.enum(["color", "scale", "underline"]),
    }),
  ),
  emojiInserts: z.array(
    z.object({ afterWordIndex: z.number().int().nonnegative(), emoji: z.string().min(1).max(8) }),
  ),
});
export type CaptionsConfig = z.infer<typeof CaptionsConfigSchema>;

export const EditPlanSchema = z.object({
  schemaVersion: z.literal(1),
  language: z.string().min(2),
  provenance: ProvenanceSchema,
  source: z.object({
    durationMs: z.number().int().positive(),
    fps: z.number().int().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  style: z.object({
    theme: z.enum(["editorial-dark"]),
    motionIntensity: z.enum(["punchy", "subtle"]),
  }),
  captions: CaptionsConfigSchema,
  scenes: z.array(SceneSchema).min(1),
});
export type EditPlan = z.infer<typeof EditPlanSchema>;

// What the renderer actually receives as inputProps: the resolved plan plus
// the word timeline (captions + trigger sync) and where to fetch the footage.
export const RenderInputSchema = z.object({
  plan: EditPlanSchema,
  words: z.array(
    z.object({
      i: z.number().int().nonnegative(),
      text: z.string(),
      startMs: z.number().int().nonnegative(),
      endMs: z.number().int().nonnegative(),
    }),
  ),
  videoSrc: z.string(), // URL the Player/renderer can fetch (served, not fs path)
});
export type RenderInput = z.infer<typeof RenderInputSchema>;
