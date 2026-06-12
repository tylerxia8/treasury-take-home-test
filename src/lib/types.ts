// Shared domain types for the TTB label verification prototype.

/** Beverage category — affects which fields TTB treats as mandatory. */
export type BeverageType = "spirits" | "wine" | "beer" | "unknown";

/**
 * What the application submission (COLA) claims the label should say.
 * Every field is optional: agents verify against whatever the application
 * provides, and mandatory-element checks (e.g. the government warning) run
 * regardless of what's filled in.
 */
export interface ExpectedApplication {
  brandName?: string;
  classType?: string;
  alcoholContent?: string;
  netContents?: string;
  bottlerName?: string;
  bottlerAddress?: string;
  countryOfOrigin?: string;
  beverageType?: BeverageType;
}

/** What Claude reads off the label image. Verbatim — no normalization here. */
export interface ExtractedLabel {
  brandName: string | null;
  classType: string | null;
  alcoholContent: string | null;
  /** Parsed numeric ABV (e.g. 45 for "45% Alc./Vol."), if determinable. */
  abvPercent: number | null;
  netContents: string | null;
  bottlerName: string | null;
  bottlerAddress: string | null;
  countryOfOrigin: string | null;
  governmentWarning: {
    present: boolean;
    /** The full warning text exactly as it appears on the label. */
    fullText: string | null;
    /** Whether the "GOVERNMENT WARNING:" heading is rendered in all caps. */
    headingAllCaps: boolean | null;
  };
  imageQuality: {
    legible: boolean;
    notes: string | null;
  };
}

export type FieldStatus =
  | "match" // label agrees with the application
  | "mismatch" // label disagrees with the application
  | "missing_on_label" // application provided a value, label has none
  | "not_provided" // application left this blank — nothing to compare
  | "info"; // extracted for context, not compared

export interface FieldCheck {
  key: string;
  label: string;
  expected: string | null;
  found: string | null;
  status: FieldStatus;
  detail: string;
}

export interface WarningCheck {
  status: "pass" | "fail";
  found: string | null;
  issues: string[];
}

export type OverallVerdict = "pass" | "review" | "fail";

export interface VerificationResult {
  /** Filename or label id this result corresponds to (useful in batch mode). */
  id: string;
  overall: OverallVerdict;
  summary: string;
  fields: FieldCheck[];
  warning: WarningCheck;
  imageQuality: { legible: boolean; notes: string | null };
  extracted: ExtractedLabel | null;
  meta: { model: string; elapsedMs: number; mock: boolean };
  /** Populated only when verification could not run (bad image, API error, …). */
  error?: string;
}
