import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { getCurrentUserId } from "@/lib/session";
import { extractLargestPhotoFromPdf, photoBufferToDataUrl } from "@/lib/pdf-image";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const form = await req.formData(); const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  const name = file.name.toLowerCase(); const buf = Buffer.from(await file.arrayBuffer());
  try {
    if (name.endsWith(".pdf")) {
      const pdfParse = require("pdf-parse/lib/pdf-parse.js"); const data = await pdfParse(buf);
      // Best-effort: if the uploaded CV already has an embedded photo, pull
      // it out so the user doesn't have to separately re-upload one. Never
      // fails the request if this doesn't find anything -- it's a bonus on
      // top of text extraction, not a requirement.
      let photoDataUrl: string | undefined;
      try {
        const photo = extractLargestPhotoFromPdf(buf);
        if (photo) photoDataUrl = photoBufferToDataUrl(photo);
      } catch {
        // ignore -- text extraction above is what actually matters
      }
      return NextResponse.json({ text: data.text, photoDataUrl });
    }
    if (name.endsWith(".docx")) { const result = await mammoth.extractRawText({ buffer: buf }); return NextResponse.json({ text: result.value }); }
    if (name.endsWith(".doc")) { return NextResponse.json({ error: "Legacy .doc files aren't supported — please save as .docx or .pdf and try again." }, { status: 400 }); }
    return NextResponse.json({ text: buf.toString("utf-8") });
  } catch (err: any) { return NextResponse.json({ error: err?.message || "Failed to parse document" }, { status: 500 }); }
}