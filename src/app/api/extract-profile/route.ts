import { NextRequest, NextResponse } from "next/server";
import { extractProfile } from "@/lib/anthropic";
import { getCurrentUserId } from "@/lib/session";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json();
  const cvText = body.cvText as string;
  if (!cvText || !cvText.trim()) {
    return NextResponse.json({ error: "cvText is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.anthropicApiKeyEncrypted) {
    return NextResponse.json(
      { error: "Add your Anthropic API key in Settings before using AI features.", code: "NO_API_KEY" },
      { status: 400 }
    );
  }
  const apiKey = decrypt(user.anthropicApiKeyEncrypted);

  try {
    const result = await extractProfile(apiKey, cvText);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: "Extraction failed: " + (err?.message || String(err)) }, { status: 502 });
  }
}