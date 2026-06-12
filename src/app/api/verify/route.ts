import { NextResponse } from "next/server";
import { verifyLabel } from "@/lib/verify";
import { SUPPORTED_MEDIA_TYPES, type SupportedMediaType } from "@/lib/extract";
import type { ExpectedApplication } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB per image

function field(form: FormData, name: string): string | undefined {
  const v = form.get(name);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image file was provided." }, { status: 400 });
  }
  if (!SUPPORTED_MEDIA_TYPES.includes(file.type as SupportedMediaType)) {
    return NextResponse.json(
      { error: `Unsupported image type "${file.type || "unknown"}". Use JPEG, PNG, WEBP, or GIF.` },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image is too large (max 12 MB). Please use a smaller image." },
      { status: 400 }
    );
  }

  const expected: ExpectedApplication = {
    brandName: field(form, "brandName"),
    classType: field(form, "classType"),
    alcoholContent: field(form, "alcoholContent"),
    netContents: field(form, "netContents"),
    bottlerName: field(form, "bottlerName"),
    bottlerAddress: field(form, "bottlerAddress"),
    countryOfOrigin: field(form, "countryOfOrigin"),
  };

  const base64Data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const id = field(form, "id") || file.name || "label";

  const result = await verifyLabel({
    id,
    expected,
    base64Data,
    mediaType: file.type as SupportedMediaType,
  });

  // Verification-level failures (bad image, API error) still return 200 with an
  // `error` field so the UI can show a per-item message in batch mode.
  return NextResponse.json(result);
}
