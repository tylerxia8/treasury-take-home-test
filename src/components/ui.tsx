import type { FieldStatus, OverallVerdict } from "@/lib/types";

const VERDICT_STYLES: Record<
  OverallVerdict,
  { label: string; box: string }
> = {
  pass: { label: "Pass", box: "bg-green-100 text-green-900 border-green-400" },
  review: { label: "Needs review", box: "bg-amber-100 text-amber-900 border-amber-400" },
  fail: { label: "Fail", box: "bg-red-100 text-red-900 border-red-400" },
};

export function VerdictBadge({
  verdict,
  size = "md",
}: {
  verdict: OverallVerdict;
  size?: "sm" | "md";
}) {
  const s = VERDICT_STYLES[verdict];
  const pad = size === "sm" ? "px-2.5 py-0.5 text-sm" : "px-4 py-1.5 text-lg";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border font-semibold ${s.box} ${pad}`}
    >
      <VerdictGlyph verdict={verdict} />
      {s.label}
    </span>
  );
}

function VerdictGlyph({ verdict }: { verdict: OverallVerdict }) {
  if (verdict === "pass") return <CheckIcon className="h-4 w-4" />;
  if (verdict === "fail") return <XIcon className="h-4 w-4" />;
  return <WarnIcon className="h-4 w-4" />;
}

export function StatusIcon({ status }: { status: FieldStatus }) {
  switch (status) {
    case "match":
      return <CheckIcon className="h-5 w-5 text-green-600" aria-label="Match" />;
    case "mismatch":
      return <XIcon className="h-5 w-5 text-red-600" aria-label="Mismatch" />;
    case "missing_on_label":
      return <WarnIcon className="h-5 w-5 text-amber-600" aria-label="Missing" />;
    default:
      return <DashIcon className="h-5 w-5 text-gray-400" aria-label="Not compared" />;
  }
}

export function CheckIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.3 3.3 6.8-6.8a1 1 0 011.4 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function XIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 8.6l3.9-3.9a1 1 0 011.4 1.4L11.4 10l3.9 3.9a1 1 0 01-1.4 1.4L10 11.4l-3.9 3.9a1 1 0 01-1.4-1.4L8.6 10 4.7 6.1a1 1 0 011.4-1.4L10 8.6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function WarnIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8.5 2.9a1.7 1.7 0 013 0l6.1 11A1.7 1.7 0 0116.1 16.5H3.9A1.7 1.7 0 012.4 13.9l6.1-11zM10 7a1 1 0 00-1 1v3a1 1 0 002 0V8a1 1 0 00-1-1zm0 7.5a1.1 1.1 0 100-2.2 1.1 1.1 0 000 2.2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function DashIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <rect x="4" y="9" width="12" height="2" rx="1" />
    </svg>
  );
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
      <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
