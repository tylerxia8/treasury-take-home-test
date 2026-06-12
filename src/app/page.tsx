"use client";

import { useEffect, useState } from "react";
import { SingleForm } from "@/components/SingleForm";
import { BatchPanel } from "@/components/BatchPanel";

type Tab = "single" | "batch";

export default function Home() {
  const [tab, setTab] = useState<Tab>("single");
  const [config, setConfig] = useState<{ mock: boolean; model: string } | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-700 text-xl font-bold text-white">
            ✓
          </div>
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">TTB Label Verifier</h1>
            <p className="text-base text-gray-600">
              Check an alcohol label against its application in seconds.
            </p>
          </div>
        </div>
      </header>

      {config?.mock && (
        <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-base text-amber-900">
          <strong>Demo mode:</strong> no API key is set, so verifications return sample results
          (the example bourbon label) instead of reading your image. Add an{" "}
          <code className="rounded bg-amber-100 px-1">ANTHROPIC_API_KEY</code> to analyze real
          images.
        </div>
      )}

      <div className="mb-6 inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        <TabButton active={tab === "single"} onClick={() => setTab("single")}>
          Single label
        </TabButton>
        <TabButton active={tab === "batch"} onClick={() => setTab("batch")}>
          Batch upload
        </TabButton>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
        {tab === "single" ? <SingleForm /> : <BatchPanel />}
      </section>

      <footer className="mt-8 text-center text-sm text-gray-400">
        Prototype · {config?.model && !config.mock ? `Powered by ${config.model}` : "Anthropic Claude"} ·
        Not connected to COLA. No data is stored.
      </footer>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-6 py-2.5 text-lg font-semibold transition ${
        active ? "bg-blue-700 text-white shadow" : "text-gray-600 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}
