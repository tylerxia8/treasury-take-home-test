"use client";

import { useState } from "react";
import type { VerificationResult } from "@/lib/types";
import { ResultDetails } from "./ResultDetails";
import { ImagePicker } from "./ImagePicker";
import { Spinner } from "./ui";

const FIELDS: { name: string; label: string; placeholder: string }[] = [
  { name: "brandName", label: "Brand name", placeholder: "Old Tom Distillery" },
  { name: "classType", label: "Class / type", placeholder: "Kentucky Straight Bourbon Whiskey" },
  { name: "alcoholContent", label: "Alcohol content", placeholder: "45% Alc./Vol." },
  { name: "netContents", label: "Net contents", placeholder: "750 mL" },
  { name: "bottlerName", label: "Bottler / producer", placeholder: "Old Tom Distillery Co." },
  { name: "bottlerAddress", label: "Bottler address", placeholder: "Bardstown, Kentucky" },
  { name: "countryOfOrigin", label: "Country of origin", placeholder: "(imports only)" },
];

export function SingleForm() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Please add a label image first.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("image", file);
      for (const [k, v] of Object.entries(values)) if (v.trim()) form.append(k, v);
      const res = await fetch("/api/verify", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verification failed. Please try again.");
      } else {
        setResult(data as VerificationResult);
      }
    } catch {
      setError("Network error — could not reach the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold">1. Add the label image</h2>
          <p className="mt-1 text-base text-gray-600">A photo or scan of the label.</p>
          <div className="mt-3">
            <ImagePicker file={file} onChange={setFile} />
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold">2. Enter what the application says</h2>
          <p className="mt-1 text-base text-gray-600">
            Fill in the fields you want checked. Leave the rest blank.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.name} className="block">
                <span className="mb-1 block text-base font-medium text-gray-800">{f.label}</span>
                <input
                  type="text"
                  value={values[f.name] ?? ""}
                  placeholder={f.placeholder}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base shadow-sm focus:border-blue-500"
                />
              </label>
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-base text-red-800">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 py-4 text-xl font-semibold text-white shadow-md transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {loading ? (
            <>
              <Spinner className="h-6 w-6" /> Checking…
            </>
          ) : (
            "Verify label"
          )}
        </button>
      </form>

      <div className="lg:border-l lg:border-gray-200 lg:pl-8">
        <h2 className="mb-3 text-xl font-semibold">Result</h2>
        {!result && !loading && (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-base text-gray-500">
            Results will appear here after you verify a label.
          </p>
        )}
        {loading && (
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-8 text-gray-600">
            <Spinner className="h-6 w-6" /> Reading the label and comparing fields…
          </div>
        )}
        {result && (
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <ResultDetails result={result} />
          </div>
        )}
      </div>
    </div>
  );
}
