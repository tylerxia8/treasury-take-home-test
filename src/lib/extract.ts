// Calls Claude's vision API to read the required fields off a label image,
// returning structured JSON. Extraction is verbatim — all judgment about
// whether a value "matches" the application happens deterministically in
// compare.ts, which keeps this step fast and the matching logic auditable.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { CANONICAL_WARNING } from "./warning";
import type { ExtractedLabel } from "./types";

export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
const EFFORT = (process.env.EXTRACTION_EFFORT || "low") as
  | "low"
  | "medium"
  | "high"
  | "max";

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Image formats Claude accepts. */
export const SUPPORTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;
export type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

// ----- Structured-output schema -----------------------------------------

const nullable = (type: string) => ({ anyOf: [{ type }, { type: "null" }] });

const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    brandName: nullable("string"),
    classType: nullable("string"),
    alcoholContent: nullable("string"),
    abvPercent: nullable("number"),
    netContents: nullable("string"),
    bottlerName: nullable("string"),
    bottlerAddress: nullable("string"),
    countryOfOrigin: nullable("string"),
    governmentWarning: {
      type: "object",
      additionalProperties: false,
      properties: {
        present: { type: "boolean" },
        fullText: nullable("string"),
        headingAllCaps: nullable("boolean"),
      },
      required: ["present", "fullText", "headingAllCaps"],
    },
    imageQuality: {
      type: "object",
      additionalProperties: false,
      properties: {
        legible: { type: "boolean" },
        notes: nullable("string"),
      },
      required: ["legible", "notes"],
    },
  },
  required: [
    "brandName",
    "classType",
    "alcoholContent",
    "abvPercent",
    "netContents",
    "bottlerName",
    "bottlerAddress",
    "countryOfOrigin",
    "governmentWarning",
    "imageQuality",
  ],
} as const;

const ExtractionZod = z.object({
  brandName: z.string().nullable(),
  classType: z.string().nullable(),
  alcoholContent: z.string().nullable(),
  abvPercent: z.number().nullable(),
  netContents: z.string().nullable(),
  bottlerName: z.string().nullable(),
  bottlerAddress: z.string().nullable(),
  countryOfOrigin: z.string().nullable(),
  governmentWarning: z.object({
    present: z.boolean(),
    fullText: z.string().nullable(),
    headingAllCaps: z.boolean().nullable(),
  }),
  imageQuality: z.object({
    legible: z.boolean(),
    notes: z.string().nullable(),
  }),
});

const PROMPT = `You are a TTB (Alcohol and Tobacco Tax and Trade Bureau) label compliance assistant.
Examine this alcohol beverage label image and extract the required fields.

Rules:
- Transcribe text EXACTLY as printed, including capitalization, punctuation, and spacing.
- If a field does not appear on the label, return null for it (do not guess).
- "alcoholContent": copy the full text as shown (e.g. "45% Alc./Vol. (90 Proof)").
- "abvPercent": the numeric alcohol-by-volume percentage as a number (e.g. 45), or null.
- "classType": the class/type designation (e.g. "Kentucky Straight Bourbon Whiskey", "Cabernet Sauvignon", "India Pale Ale").
- "netContents": the volume statement (e.g. "750 mL").
- "bottlerName" / "bottlerAddress": the name and address of the bottler/producer/importer.
- "countryOfOrigin": only if stated on the label (common on imports).
- "governmentWarning.fullText": the COMPLETE warning text exactly as printed, including the heading.
- "governmentWarning.headingAllCaps": true only if the heading reads "GOVERNMENT WARNING:" in all capital letters on the label.
- "imageQuality.notes": briefly note any glare, blur, skew, low resolution, or cropping that affected reading; otherwise null.

Be precise. This is used to verify a regulated label against its application.`;

// ----- Mock mode ---------------------------------------------------------

/** Realistic canned extraction so the UI is usable without an API key. */
function mockExtraction(): ExtractedLabel {
  return {
    brandName: "OLD TOM DISTILLERY",
    classType: "Kentucky Straight Bourbon Whiskey",
    alcoholContent: "45% Alc./Vol. (90 Proof)",
    abvPercent: 45,
    netContents: "750 mL",
    bottlerName: "Old Tom Distillery Co.",
    bottlerAddress: "Bardstown, Kentucky",
    countryOfOrigin: null,
    governmentWarning: {
      present: true,
      fullText: CANONICAL_WARNING,
      headingAllCaps: true,
    },
    imageQuality: { legible: true, notes: "Mock mode — no image was analyzed." },
  };
}

// ----- Main entry point --------------------------------------------------

export interface ExtractionOutcome {
  extracted: ExtractedLabel;
  model: string;
  mock: boolean;
}

/**
 * Extract label fields from a base64-encoded image.
 * Falls back to mock mode when ANTHROPIC_API_KEY is not set.
 */
export async function extractLabel(
  base64Data: string,
  mediaType: SupportedMediaType
): Promise<ExtractionOutcome> {
  if (!hasApiKey()) {
    return { extracted: mockExtraction(), model: "mock", mock: true };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = DEFAULT_MODEL;

  // Effort is supported on Opus/Sonnet 4.x but not Haiku — omit it there.
  const outputConfig: Record<string, unknown> = {
    format: { type: "json_schema", schema: EXTRACTION_JSON_SCHEMA },
  };
  if (!model.includes("haiku")) outputConfig.effort = EFFORT;

  // `output_config` (structured outputs) may be newer than the installed SDK's
  // request types, so we build the params loosely and pin the response type.
  const params = {
    model,
    max_tokens: 3000,
    output_config: outputConfig,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  };
  const response = (await client.messages.create(
    params as Anthropic.MessageCreateParamsNonStreaming
  )) as Anthropic.Message;

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("The model returned no readable output for this image.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error("Could not parse the model's response as JSON.");
  }

  const extracted = ExtractionZod.parse(parsed) as ExtractedLabel;
  return { extracted, model, mock: false };
}
