import { NextRequest, NextResponse } from "next/server";
import { extractProfile } from "@/lib/anthropic";
import { getCurrentUserId } from "@/lib/session";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json();
  const cvText = body.cvText as string;
  if (!cvText || !cvText.trim()) {
    return NextResponse.json({ error: "cvText is required" }, { status: 400 });
  }
  try {
    const result = await extractProfile(cvText);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: "Extraction failed: " + (err?.message || String(err)) }, { status: 502 });
  }
}