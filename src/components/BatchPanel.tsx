"use client";

import { useMemo, useRef, useState } from "react";
import type { ExpectedApplication, VerificationResult } from "@/lib/types";
import { parseApplicationCsv } from "@/lib/csv";
import { mapWithConcurrency } from "@/lib/pool";
import { VerdictBadge, Spinner } from "./ui";
import { ResultDetails } from "./ResultDetails";

const CONCURRENCY = 6;

type ItemStatus = "queued" | "running" | "done" | "error";

interface BatchItem {
  id: string;
  file: File;
  expected: ExpectedApplication;
  matched: boolean;
  status: ItemStatus;
  result?: VerificationResult;
}

export function BatchPanel() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [csvWarnings, setCsvWarnings] = useState<string[]>([]);
  const [csvName, setCsvName] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const csvMapRef = useRef<Map<string, ExpectedApplication>>(new Map());
  const imageInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  function applyCsvToItems(map: Map<string, ExpectedApplication>) {
    setItems((prev) =>
      prev.map((it) => {
        const exp = map.get(it.file.name.toLowerCase());
        return { ...it, expected: exp ?? {}, matched: Boolean(exp) };
      })
    );
  }

  async function handleCsv(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    const parsed = parseApplicationCsv(text);
    csvMapRef.current = parsed.byFilename;
    setCsvName(file.name);
    setCsvWarnings(parsed.warnings);
    applyCsvToItems(parsed.byFilename);
  }

  function addImages(files: FileList | null) {
    if (!files) return;
    const map = csvMapRef.current;
    const next: BatchItem[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => {
        const exp = map.get(f.name.toLowerCase());
        return {
          id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 8)}`,
          file: f,
          expected: exp ?? {},
          matched: Boolean(exp),
          status: "queued" as ItemStatus,
        };
      });
    setItems((prev) => [...prev, ...next]);
  }

  async function verifyOne(item: BatchItem): Promise<VerificationResult> {
    const form = new FormData();
    form.append("image", item.file);
    form.append("id", item.file.name);
    for (const [k, v] of Object.entries(item.expected)) {
      if (typeof v === "string" && v.trim()) form.append(k, v);
    }
    const res = await fetch("/api/verify", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) {
      return {
        id: item.file.name,
        overall: "fail",
        summary: "Request failed.",
        fields: [],
        warning: { status: "fail", found: null, issues: [data.error || "Request failed."] },
        imageQuality: { legible: false, notes: null },
        extracted: null,
        meta: { model: "n/a", elapsedMs: 0, mock: false },
        error: data.error || "Request failed.",
      };
    }
    return data as VerificationResult;
  }

  async function runAll() {
    setRunning(true);
    const queue = items.filter((it) => it.status !== "done");
    await mapWithConcurrency(queue, CONCURRENCY, async (item) => {
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: "running" } : it))
      );
      try {
        const result = await verifyOne(item);
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, status: result.error ? "error" : "done", result }
              : it
          )
        );
      } catch {
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, status: "error" } : it))
        );
      }
    });
    setRunning(false);
  }

  function reset() {
    setItems([]);
    setCsvWarnings([]);
    setCsvName(null);
    csvMapRef.current = new Map();
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (csvInputRef.current) csvInputRef.current.value = "";
  }

  const counts = useMemo(() => {
    const c = { pass: 0, review: 0, fail: 0, done: 0, matched: 0 };
    for (const it of items) {
      if (it.matched) c.matched++;
      if (it.status === "done" && it.result) {
        c.done++;
        c[it.result.overall]++;
      } else if (it.status === "error") {
        c.done++;
        c.fail++;
      }
    }
    return c;
  }, [items]);

  function downloadCsv() {
    const header = ["filename", "verdict", "warning", "issues", "summary"];
    const rows = items
      .filter((it) => it.result)
      .map((it) => {
        const r = it.result!;
        const mism = r.fields.filter((f) => f.status === "mismatch" || f.status === "missing_on_label").map((f) => f.label);
        const issues = [...r.warning.issues, ...mism].join("; ");
        return [it.file.name, r.overall, r.warning.status, issues, r.summary].map(
          (cell) => `"${String(cell).replace(/"/g, '""')}"`
        );
      });
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "verification-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Step 1: optional CSV */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-lg font-semibold">1. Application data (optional)</h3>
          <p className="mt-1 text-base text-gray-600">
            A CSV with a <code className="rounded bg-gray-100 px-1">filename</code> column plus the
            expected fields. Rows are matched to images by filename.
          </p>
          <button
            type="button"
            onClick={() => csvInputRef.current?.click()}
            className="mt-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-base font-medium hover:border-blue-400"
          >
            {csvName ? `CSV: ${csvName}` : "Choose CSV file"}
          </button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => handleCsv(e.target.files?.[0])}
          />
          {csvWarnings.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm text-amber-700">
              {csvWarnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm text-gray-500">
            No CSV? You can still upload labels — they&apos;ll be checked for the mandatory
            government warning and required fields.
          </p>
        </div>

        {/* Step 2: images */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-lg font-semibold">2. Label images</h3>
          <p className="mt-1 text-base text-gray-600">Select many at once.</p>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="mt-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-base font-medium hover:border-blue-400"
          >
            Add label images
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => addImages(e.target.files)}
          />
          {items.length > 0 && (
            <p className="mt-2 text-base text-gray-600">
              {items.length} image{items.length > 1 ? "s" : ""} loaded
              {csvName ? ` · ${counts.matched} matched to application rows` : ""}.
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={runAll}
            disabled={running}
            className="flex items-center gap-2 rounded-xl bg-blue-700 px-6 py-3 text-lg font-semibold text-white shadow-md hover:bg-blue-800 disabled:bg-gray-400"
          >
            {running ? (
              <>
                <Spinner className="h-5 w-5" /> Verifying {counts.done}/{items.length}…
              </>
            ) : (
              `Verify all ${items.length}`
            )}
          </button>
          {counts.done > 0 && (
            <button
              type="button"
              onClick={downloadCsv}
              className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-lg font-medium hover:border-blue-400"
            >
              Download results (CSV)
            </button>
          )}
          <button
            type="button"
            onClick={reset}
            disabled={running}
            className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-lg font-medium hover:border-gray-400 disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      )}

      {/* Summary counts */}
      {counts.done > 0 && (
        <div className="flex flex-wrap gap-3 text-base">
          <SummaryPill label="Passed" value={counts.pass} className="bg-green-100 text-green-900" />
          <SummaryPill label="Needs review" value={counts.review} className="bg-amber-100 text-amber-900" />
          <SummaryPill label="Failed" value={counts.fail} className="bg-red-100 text-red-900" />
        </div>
      )}

      {/* Results table */}
      {items.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-sm uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Label</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Notes</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <BatchRow
                  key={it.id}
                  item={it}
                  expanded={expanded === it.id}
                  onToggle={() => setExpanded(expanded === it.id ? null : it.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryPill({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <span className={`rounded-full px-4 py-1.5 font-semibold ${className}`}>
      {value} {label}
    </span>
  );
}

function BatchRow({
  item,
  expanded,
  onToggle,
}: {
  item: BatchItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const r = item.result;
  return (
    <>
      <tr className="border-t border-gray-100 align-middle">
        <td className="px-4 py-3 font-medium">
          {item.file.name}
          {!item.matched && (
            <span className="ml-2 text-sm text-gray-400">(no application row)</span>
          )}
        </td>
        <td className="px-4 py-3">
          {item.status === "queued" && <span className="text-gray-500">Queued</span>}
          {item.status === "running" && (
            <span className="inline-flex items-center gap-2 text-blue-700">
              <Spinner className="h-4 w-4" /> Checking…
            </span>
          )}
          {(item.status === "done" || item.status === "error") && r && (
            <VerdictBadge verdict={r.overall} size="sm" />
          )}
        </td>
        <td className="px-4 py-3 text-base text-gray-600">{r?.summary ?? ""}</td>
        <td className="px-4 py-3 text-right">
          {r && (
            <button
              type="button"
              onClick={onToggle}
              className="font-medium text-blue-700 hover:underline"
            >
              {expanded ? "Hide" : "Details"}
            </button>
          )}
        </td>
      </tr>
      {expanded && r && (
        <tr className="border-t border-gray-100 bg-gray-50">
          <td colSpan={4} className="px-4 py-4">
            <ResultDetails result={r} />
          </td>
        </tr>
      )}
    </>
  );
}
