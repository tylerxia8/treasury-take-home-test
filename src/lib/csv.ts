// Minimal CSV parser + mapping to ExpectedApplication, keyed by image filename.
// Used in batch mode: an agent uploads a CSV of application records (one row per
// label, exported from their system) alongside the label images. Rows are matched
// to images by the `filename` column.
//
// Pure and dependency-free so it runs in the browser.

import type { ExpectedApplication } from "./types";

/** Parse CSV text into an array of string cells per row (handles quotes/commas/CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, ""); // strip BOM

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

// Accept several reasonable header spellings for each field.
const HEADER_MAP: Record<string, keyof ExpectedApplication | "filename"> = {
  filename: "filename",
  file: "filename",
  image: "filename",
  image_filename: "filename",
  brand_name: "brandName",
  brand: "brandName",
  class_type: "classType",
  class: "classType",
  type: "classType",
  class_type_designation: "classType",
  alcohol_content: "alcoholContent",
  abv: "alcoholContent",
  alcohol: "alcoholContent",
  alc_vol: "alcoholContent",
  net_contents: "netContents",
  volume: "netContents",
  net_contents_volume: "netContents",
  bottler_name: "bottlerName",
  bottler: "bottlerName",
  producer: "bottlerName",
  producer_name: "bottlerName",
  bottler_address: "bottlerAddress",
  address: "bottlerAddress",
  country_of_origin: "countryOfOrigin",
  country: "countryOfOrigin",
  origin: "countryOfOrigin",
};

export interface CsvApplicationRow {
  filename: string;
  expected: ExpectedApplication;
}

export interface CsvParseResult {
  rows: CsvApplicationRow[];
  byFilename: Map<string, ExpectedApplication>;
  warnings: string[];
}

/** Parse a CSV of application records into per-filename expected values. */
export function parseApplicationCsv(text: string): CsvParseResult {
  const grid = parseCsv(text);
  const warnings: string[] = [];
  if (grid.length < 2) {
    return { rows: [], byFilename: new Map(), warnings: ["CSV has no data rows."] };
  }

  const headers = grid[0].map(normalizeHeader);
  const cols = headers.map((h) => HEADER_MAP[h] ?? null);
  if (!cols.includes("filename")) {
    warnings.push('CSV is missing a "filename" column — rows can\'t be matched to images.');
  }

  const rows: CsvApplicationRow[] = [];
  const byFilename = new Map<string, ExpectedApplication>();

  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r];
    const expected: ExpectedApplication = {};
    let filename = "";
    cols.forEach((key, c) => {
      if (!key) return;
      const value = (cells[c] ?? "").trim();
      if (!value) return;
      if (key === "filename") filename = value;
      // All mapped keys are string-valued text fields (beverageType isn't mapped).
      else (expected as Record<string, string>)[key] = value;
    });
    if (!filename) continue;
    rows.push({ filename, expected });
    byFilename.set(filename.toLowerCase(), expected);
  }

  return { rows, byFilename, warnings };
}
