import type { VerificationResult } from "@/lib/types";
import { VerdictBadge, StatusIcon, CheckIcon, XIcon } from "./ui";

export function ResultDetails({ result }: { result: VerificationResult }) {
  if (result.error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">
        <p className="font-semibold">Could not verify this label</p>
        <p className="mt-1 text-base">{result.error}</p>
      </div>
    );
  }

  const warningOk = result.warning.status === "pass";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <VerdictBadge verdict={result.overall} />
        <p className="text-base text-gray-600">{result.summary}</p>
      </div>

      {/* Government Warning — called out separately because it's mandatory. */}
      <section
        className={`rounded-lg border p-4 ${
          warningOk ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"
        }`}
      >
        <div className="flex items-center gap-2">
          {warningOk ? (
            <CheckIcon className="h-6 w-6 text-green-600" />
          ) : (
            <XIcon className="h-6 w-6 text-red-600" />
          )}
          <h3 className="text-lg font-semibold">Government Warning Statement</h3>
        </div>
        {warningOk ? (
          <p className="mt-1 text-base text-green-900">
            Present and matches the required federal wording, heading in all caps.
          </p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-6 text-base text-red-900">
            {result.warning.issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        )}
        {result.warning.found && (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm text-gray-600">
              Show warning text read from the label
            </summary>
            <p className="mt-1 whitespace-pre-wrap rounded bg-white/70 p-2 text-sm text-gray-800">
              {result.warning.found}
            </p>
          </details>
        )}
      </section>

      {/* Field-by-field comparison. */}
      <section>
        <h3 className="mb-2 text-lg font-semibold">Field comparison</h3>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full border-collapse text-left">
            <thead className="bg-gray-50 text-sm uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-10 px-3 py-2"></th>
                <th className="px-3 py-2">Field</th>
                <th className="px-3 py-2">Application says</th>
                <th className="px-3 py-2">Label shows</th>
              </tr>
            </thead>
            <tbody className="text-base">
              {result.fields.map((f) => (
                <tr key={f.key} className="border-t border-gray-100 align-top">
                  <td className="px-3 py-3">
                    <StatusIcon status={f.status} />
                  </td>
                  <td className="px-3 py-3 font-medium">{f.label}</td>
                  <td className="px-3 py-3 text-gray-700">
                    {f.expected ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-3">
                    <span className={f.status === "mismatch" ? "text-red-700" : "text-gray-700"}>
                      {f.found ?? <span className="text-gray-400">not found</span>}
                    </span>
                    <p className="mt-0.5 text-sm text-gray-500">{f.detail}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Image quality + run metadata. */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">
        <span>
          {result.imageQuality.legible ? "Image legible." : "Image quality flagged."}
          {result.imageQuality.notes ? ` ${result.imageQuality.notes}` : ""}
        </span>
        <span>
          {result.meta.mock ? "Mock mode · " : ""}
          {result.meta.model} · {(result.meta.elapsedMs / 1000).toFixed(1)}s
        </span>
      </div>
    </div>
  );
}
