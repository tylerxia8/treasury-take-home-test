// Field-by-field comparison between the application (expected) and the label
// (extracted by Claude). Comparison is deterministic and transparent on purpose:
// a compliance tool should be auditable, and the rules below explain *why* two
// values are considered the same.
//
// Dave (28-yr agent) gave the canonical example: "STONE'S THROW" on the label
// vs "Stone's Throw" in the application is obviously the same thing. So matching
// is case-, punctuation-, accent-, and whitespace-insensitive — without being so
// loose that real mismatches slip through.

import type { ExpectedApplication, ExtractedLabel, FieldCheck } from "./types";

/** Lowercase, strip accents, normalize quotes, collapse punctuation/whitespace. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/['‘’ʼ`]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/[^a-z0-9%./\s'-]/g, " ") // drop stray punctuation
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein ratio in [0,1] — used to flag "close but not equal" values. */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prev = tmp;
    }
  }
  return 1 - dp[n] / Math.max(m, n);
}

/** Parse an alcohol-by-volume percentage out of free-form text. */
export function parseAbv(value: string | null | undefined): number | null {
  if (!value) return null;
  // Prefer an explicit percentage; fall back to a bare leading number.
  const pct = value.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) return parseFloat(pct[1]);
  const alc = value.match(/(\d+(?:\.\d+)?)\s*(?:alc|abv)/i);
  if (alc) return parseFloat(alc[1]);
  const bare = value.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
  if (bare) return parseFloat(bare[1]);
  return null;
}

/** Parse a net-contents quantity into milliliters for unit-agnostic comparison. */
export function parseVolumeMl(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = value
    .toLowerCase()
    .replace(/,/g, ".")
    .match(/(\d+(?:\.\d+)?)\s*(ml|millilit(?:er|re)s?|cl|l|lit(?:er|re)s?|fl\.?\s*oz|oz)/);
  if (!m) return null;
  const qty = parseFloat(m[1]);
  const unit = m[2].replace(/\s+/g, "");
  if (unit.startsWith("ml") || unit.startsWith("millilit")) return qty;
  if (unit === "cl") return qty * 10;
  if (unit === "l" || unit.startsWith("lit")) return qty * 1000;
  if (unit.startsWith("fl") || unit === "oz") return qty * 29.5735;
  return null;
}

type CompareOutcome = { matched: boolean; detail: string };

/** Generic text field (brand, class/type, bottler, country, address). */
function compareTextField(expected: string, found: string): CompareOutcome {
  const ne = normalizeText(expected);
  const nf = normalizeText(found);
  if (ne === nf) {
    return { matched: true, detail: "Matches the application (ignoring case/punctuation)." };
  }
  const sim = similarity(ne, nf);
  if (sim >= 0.85) {
    return {
      matched: false,
      detail: `Close but not identical (about ${Math.round(sim * 100)}% similar) — recommend a quick visual check.`,
    };
  }
  // One fully contains the other (e.g. "Old Tom" vs "Old Tom Distillery").
  if (ne.includes(nf) || nf.includes(ne)) {
    return {
      matched: false,
      detail: "Partial match — one value contains the other. Confirm they refer to the same thing.",
    };
  }
  return { matched: false, detail: "Does not match the application." };
}

function compareAbv(expected: string, found: string | null, abvPercent: number | null): CompareOutcome {
  const exp = parseAbv(expected);
  const fnd = abvPercent ?? parseAbv(found);
  if (exp === null || fnd === null) {
    // Fall back to text comparison if we can't parse a number.
    return compareTextField(expected, found ?? "");
  }
  if (Math.abs(exp - fnd) < 0.05) {
    return { matched: true, detail: `Alcohol content matches (${fnd}% ABV).` };
  }
  return {
    matched: false,
    detail: `Application says ${exp}% but the label shows ${fnd}%.`,
  };
}

function compareNetContents(expected: string, found: string): CompareOutcome {
  const exp = parseVolumeMl(expected);
  const fnd = parseVolumeMl(found);
  if (exp === null || fnd === null) {
    return compareTextField(expected, found);
  }
  if (Math.abs(exp - fnd) <= 1) {
    return { matched: true, detail: "Net contents match." };
  }
  return {
    matched: false,
    detail: `Application says ${expected} (~${Math.round(exp)} mL) but the label shows ${found} (~${Math.round(fnd)} mL).`,
  };
}

interface FieldSpec {
  key: keyof ExpectedApplication;
  label: string;
  found: (e: ExtractedLabel) => string | null;
  compare: (expected: string, e: ExtractedLabel) => CompareOutcome;
}

const FIELD_SPECS: FieldSpec[] = [
  {
    key: "brandName",
    label: "Brand name",
    found: (e) => e.brandName,
    compare: (exp, e) => compareTextField(exp, e.brandName ?? ""),
  },
  {
    key: "classType",
    label: "Class / type",
    found: (e) => e.classType,
    compare: (exp, e) => compareTextField(exp, e.classType ?? ""),
  },
  {
    key: "alcoholContent",
    label: "Alcohol content (ABV)",
    found: (e) => e.alcoholContent,
    compare: (exp, e) => compareAbv(exp, e.alcoholContent, e.abvPercent),
  },
  {
    key: "netContents",
    label: "Net contents",
    found: (e) => e.netContents,
    compare: (exp, e) => compareNetContents(exp, e.netContents ?? ""),
  },
  {
    key: "bottlerName",
    label: "Bottler / producer name",
    found: (e) => e.bottlerName,
    compare: (exp, e) => compareTextField(exp, e.bottlerName ?? ""),
  },
  {
    key: "bottlerAddress",
    label: "Bottler / producer address",
    found: (e) => e.bottlerAddress,
    compare: (exp, e) => compareTextField(exp, e.bottlerAddress ?? ""),
  },
  {
    key: "countryOfOrigin",
    label: "Country of origin",
    found: (e) => e.countryOfOrigin,
    compare: (exp, e) => compareTextField(exp, e.countryOfOrigin ?? ""),
  },
];

/** Build the per-field comparison between the application and the label. */
export function buildFieldChecks(
  expected: ExpectedApplication,
  extracted: ExtractedLabel
): FieldCheck[] {
  return FIELD_SPECS.map((spec) => {
    const expectedRaw = (expected[spec.key] as string | undefined)?.trim() || "";
    const found = spec.found(extracted);

    if (!expectedRaw) {
      return {
        key: spec.key,
        label: spec.label,
        expected: null,
        found: found ?? null,
        status: "not_provided",
        detail: found
          ? "Not in the application — shown for reference."
          : "Not provided by the application and not detected on the label.",
      } satisfies FieldCheck;
    }

    if (!found || found.trim() === "") {
      return {
        key: spec.key,
        label: spec.label,
        expected: expectedRaw,
        found: null,
        status: "missing_on_label",
        detail: "The application expects this, but it could not be found on the label.",
      } satisfies FieldCheck;
    }

    const outcome = spec.compare(expectedRaw, extracted);
    return {
      key: spec.key,
      label: spec.label,
      expected: expectedRaw,
      found,
      status: outcome.matched ? "match" : "mismatch",
      detail: outcome.detail,
    } satisfies FieldCheck;
  });
}
