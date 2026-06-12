import { NextResponse } from "next/server";
import { hasApiKey, DEFAULT_MODEL } from "@/lib/extract";

export const runtime = "nodejs";

/** Lets the UI show a banner when running without a key (mock mode). */
export async function GET() {
  return NextResponse.json({
    mock: !hasApiKey(),
    model: hasApiKey() ? DEFAULT_MODEL : "mock",
  });
}
