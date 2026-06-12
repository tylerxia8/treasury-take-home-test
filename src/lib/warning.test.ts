import { test } from "node:test";
import assert from "node:assert/strict";
import { checkGovernmentWarning, CANONICAL_WARNING } from "./warning.ts";
import type { ExtractedLabel } from "./types.ts";

function withWarning(
  fullText: string | null,
  present = true,
  headingAllCaps: boolean | null = null
): ExtractedLabel {
  return {
    brandName: null,
    classType: null,
    alcoholContent: null,
    abvPercent: null,
    netContents: null,
    bottlerName: null,
    bottlerAddress: null,
    countryOfOrigin: null,
    governmentWarning: { present, fullText, headingAllCaps },
    imageQuality: { legible: true, notes: null },
  };
}

test("compliant warning passes", () => {
  const r = checkGovernmentWarning(withWarning(CANONICAL_WARNING, true, true));
  assert.equal(r.status, "pass");
  assert.equal(r.issues.length, 0);
});

test("missing warning fails", () => {
  const r = checkGovernmentWarning(withWarning(null, false));
  assert.equal(r.status, "fail");
  assert.match(r.issues[0], /mandatory/i);
});

test("title-case heading fails (must be all caps)", () => {
  const titleCase = CANONICAL_WARNING.replace("GOVERNMENT WARNING:", "Government Warning:");
  const r = checkGovernmentWarning(withWarning(titleCase, true, false));
  assert.equal(r.status, "fail");
  assert.ok(r.issues.some((i) => /all caps/i.test(i)));
});

test("altered wording fails", () => {
  const altered =
    "GOVERNMENT WARNING: Drinking during pregnancy may be harmful and alcohol impairs driving.";
  const r = checkGovernmentWarning(withWarning(altered, true, true));
  assert.equal(r.status, "fail");
  assert.ok(r.issues.some((i) => /match the required/i.test(i)));
});

test("whitespace differences are tolerated", () => {
  const spaced = CANONICAL_WARNING.replace(/ /g, "  ").replace(/\. /g, ".\n");
  const r = checkGovernmentWarning(withWarning(spaced, true, true));
  assert.equal(r.status, "pass");
});
