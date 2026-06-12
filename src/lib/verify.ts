// Orchestrates a single label verification: extract -> compare -> verdict.

import { extractLabel, type SupportedMediaType } from "./extract";
import { buildFieldChecks } from "./compare";
import { checkGovernmentWarning } from "./warning";
import type {
  ExpectedApplication,
  OverallVerdict,
  VerificationResult,
} from "./types";

function decideVerdict(
  fields: ReturnType<typeof buildFieldChecks>,
  warningPass: boolean,
  legible: boolean
): { verdict: OverallVerdict; summary: string } {
  const mismatches = fields.filter((f) => f.status === "mismatch").length;
  const missing = fields.filter((f) => f.status === "missing_on_label").length;

  if (!warningPass) {
    return {
      verdict: "fail",
      summary:
        "Government Warning Statement issue — this is a mandatory element and must be corrected.",
    };
  }
  if (mismatches > 0 || missing > 0) {
    const parts: string[] = [];
    if (mismatches)
      parts.push(
        mismatches > 1 ? `${mismatches} fields don't match` : `1 field doesn't match`
      );
    if (missing)
      parts.push(
        missing > 1
          ? `${missing} required fields missing from the label`
          : `1 required field missing from the label`
      );
    return {
      verdict: "review",
      summary: `Needs a human look: ${parts.join(", ")}.`,
    };
  }
  if (!legible) {
    return {
      verdict: "review",
      summary: "All checks passed, but image quality was flagged — verify visually.",
    };
  }
  return { verdict: "pass", summary: "All checks passed. Label matches the application." };
}

export async function verifyLabel(params: {
  id: string;
  expected: ExpectedApplication;
  base64Data: string;
  mediaType: SupportedMediaType;
}): Promise<VerificationResult> {
  const { id, expected, base64Data, mediaType } = params;
  const started = Date.now();

  try {
    const { extracted, model, mock } = await extractLabel(base64Data, mediaType);
    const fields = buildFieldChecks(expected, extracted);
    const warning = checkGovernmentWarning(extracted);
    const { verdict, summary } = decideVerdict(
      fields,
      warning.status === "pass",
      extracted.imageQuality.legible
    );

    return {
      id,
      overall: verdict,
      summary,
      fields,
      warning,
      imageQuality: extracted.imageQuality,
      extracted,
      meta: { model, elapsedMs: Date.now() - started, mock },
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected error during verification.";
    return {
      id,
      overall: "fail",
      summary: "Could not verify this label.",
      fields: [],
      warning: { status: "fail", found: null, issues: [message] },
      imageQuality: { legible: false, notes: null },
      extracted: null,
      meta: { model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8", elapsedMs: Date.now() - started, mock: false },
      error: message,
    };
  }
}
