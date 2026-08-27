import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { getCurrentUserId } from "@/lib/session";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const form = await req.formData(); const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  const name = file.name.toLowerCase(); const buf = Buffer.from(await file.arrayBuffer());
  try {
    if (name.endsWith(".pdf")) { const pdfParse = require("pdf-parse/lib/pdf-parse.js"); const data = await pdfParse(buf); return NextResponse.json({ text: data.text }); }
    if (name.endsWith(".docx")) { const result = await mammoth.extractRawText({ buffer: buf }); return NextResponse.json({ text: result.value }); }
    if (name.endsWith(".doc")) { return NextResponse.json({ error: "Legacy .doc files aren't supported — please save as .docx or .pdf and try again." }, { status: 400 }); }
    return NextResponse.json({ text: buf.toString("utf-8") });
  } catch (err: any) { return NextResponse.json({ error: err?.message || "Failed to parse document" }, { status: 500 }); }
}