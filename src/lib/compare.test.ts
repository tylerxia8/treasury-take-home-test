import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeText, parseAbv, parseVolumeMl, buildFieldChecks } from "./compare.ts";
import type { ExtractedLabel } from "./types.ts";

function makeExtracted(overrides: Partial<ExtractedLabel> = {}): ExtractedLabel {
  return {
    brandName: "OLD TOM DISTILLERY",
    classType: "Kentucky Straight Bourbon Whiskey",
    alcoholContent: "45% Alc./Vol. (90 Proof)",
    abvPercent: 45,
    netContents: "750 mL",
    bottlerName: "Old Tom Distillery Co.",
    bottlerAddress: "Bardstown, Kentucky",
    countryOfOrigin: null,
    governmentWarning: { present: true, fullText: null, headingAllCaps: true },
    imageQuality: { legible: true, notes: null },
    ...overrides,
  };
}

test("normalizeText ignores case and punctuation (Dave's STONE'S THROW case)", () => {
  assert.equal(normalizeText("STONE'S THROW"), normalizeText("Stone's Throw"));
  assert.equal(normalizeText("Château Margaux"), normalizeText("chateau margaux"));
});

test("parseAbv pulls a percentage from varied formats", () => {
  assert.equal(parseAbv("45% Alc./Vol. (90 Proof)"), 45);
  assert.equal(parseAbv("ABV 12.5%"), 12.5);
  assert.equal(parseAbv("40"), 40);
  assert.equal(parseAbv("no number here"), null);
});

test("parseVolumeMl normalizes units (750 mL == 0.75 L == 750ml)", () => {
  assert.equal(parseVolumeMl("750 mL"), 750);
  assert.equal(parseVolumeMl("750ml"), 750);
  assert.equal(parseVolumeMl("0.75 L"), 750);
  assert.equal(parseVolumeMl("75 cl"), 750);
});

test("matching application -> all compared fields match", () => {
  const checks = buildFieldChecks(
    { brandName: "Old Tom Distillery", alcoholContent: "45%", netContents: "750ml" },
    makeExtracted()
  );
  const byKey = Object.fromEntries(checks.map((c) => [c.key, c.status]));
  assert.equal(byKey.brandName, "match");
  assert.equal(byKey.alcoholContent, "match");
  assert.equal(byKey.netContents, "match");
});

test("wrong ABV -> mismatch", () => {
  const checks = buildFieldChecks({ alcoholContent: "12%" }, makeExtracted());
  assert.equal(checks.find((c) => c.key === "alcoholContent")?.status, "mismatch");
});

test("expected field absent from label -> missing_on_label", () => {
  const checks = buildFieldChecks(
    { countryOfOrigin: "France" },
    makeExtracted({ countryOfOrigin: null })
  );
  assert.equal(checks.find((c) => c.key === "countryOfOrigin")?.status, "missing_on_label");
});

test("blank application field -> not_provided", () => {
  const checks = buildFieldChecks({ brandName: "Old Tom Distillery" }, makeExtracted());
  assert.equal(checks.find((c) => c.key === "bottlerName")?.status, "not_provided");
});
