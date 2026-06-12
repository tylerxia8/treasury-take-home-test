// The mandatory federal Government Warning Statement (27 CFR 16.21).
// This text must appear word-for-word, with the heading in all caps.
//
// Jenny (junior agent) flagged that this is the single most-gamed element:
// people shrink the font, retype it loosely, or use title case. So the check
// is intentionally strict about wording and heading capitalization.

import type { ExtractedLabel, WarningCheck } from "./types";

export const WARNING_HEADING = "GOVERNMENT WARNING:";

export const CANONICAL_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not " +
  "drink alcoholic beverages during pregnancy because of the risk of birth defects. " +
  "(2) Consumption of alcoholic beverages impairs your ability to drive a car or " +
  "operate machinery, and may cause health problems.";

/** Collapse whitespace and standardize quotes/dashes for tolerant body comparison. */
function normalizeForBody(text: string): string {
  return text
    .replace(/[‘’ʼ]/g, "'") // curly/modifier apostrophes -> '
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Strip the heading so we can compare just the warning body. */
function bodyOnly(text: string): string {
  return normalizeForBody(text).replace(/^government warning:\s*/i, "");
}

/**
 * Verify the government warning against the federal requirement.
 *
 * Rules enforced:
 *  - The warning must be present.
 *  - The heading "GOVERNMENT WARNING:" must be in all caps.
 *  - The body wording must match the canonical text (whitespace-tolerant,
 *    case-tolerant for the body — only the heading must be uppercase).
 */
export function checkGovernmentWarning(extracted: ExtractedLabel): WarningCheck {
  const gw = extracted.governmentWarning;
  const issues: string[] = [];

  if (!gw.present || !gw.fullText || gw.fullText.trim() === "") {
    return {
      status: "fail",
      found: gw.fullText ?? null,
      issues: ["No Government Warning Statement found on the label (this is mandatory)."],
    };
  }

  const raw = gw.fullText;

  // Heading must be all caps. Trust the model's explicit flag if it set one,
  // but also verify against the literal text we received.
  const hasUpperHeading = raw.includes(WARNING_HEADING);
  const hasAnyCaseHeading = /government\s+warning\s*:/i.test(raw);
  if (!hasUpperHeading) {
    if (hasAnyCaseHeading) {
      issues.push(
        'Heading is not in all caps — it must read exactly "GOVERNMENT WARNING:".'
      );
    } else {
      issues.push('Missing the required "GOVERNMENT WARNING:" heading.');
    }
  }
  if (gw.headingAllCaps === false && hasUpperHeading) {
    // Model saw mixed case in the rendered image even if the transcript is upper.
    issues.push("Heading may not be rendered in all caps on the label — verify visually.");
  }

  // Body wording must match the federal text.
  if (bodyOnly(raw) !== bodyOnly(CANONICAL_WARNING)) {
    issues.push(
      "Warning wording does not match the required federal text exactly. " +
        "Compare against the standard statement."
    );
  }

  return {
    status: issues.length === 0 ? "pass" : "fail",
    found: raw,
    issues,
  };
}
