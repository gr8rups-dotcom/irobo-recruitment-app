import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { encrypt } from "@/lib/crypto";

export const runtime = "nodejs";

// Never return the decrypted key to the browser — only whether one is set.
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  return NextResponse.json({ hasKey: !!user?.anthropicApiKeyEncrypted });
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json();
  const apiKey = (body.apiKey as string || "").trim();
  if (!apiKey.startsWith("sk-ant-")) {
    return NextResponse.json({ error: "That doesn't look like an Anthropic API key (should start with sk-ant-)." }, { status: 400 });
  }

  // Validate the key actually works before saving it, with the cheapest
  // possible real call (1 output token) so a typo is caught immediately
  // instead of surfacing later as a confusing failure mid-generation.
  try {
    const client = new Anthropic({ apiKey });
    await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }],
    });
  } catch (err: any) {
    const status = err?.status;
    if (status === 401) {
      return NextResponse.json({ error: "That key was rejected by Anthropic — double-check you copied it correctly." }, { status: 400 });
    }
    // Other errors (rate limit, etc.) don't mean the key is invalid — allow saving.
  }

  await prisma.user.update({
    where: { id: userId },
    data: { anthropicApiKeyEncrypted: encrypt(apiKey) },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await prisma.user.update({ where: { id: userId }, data: { anthropicApiKeyEncrypted: null } });
  return NextResponse.json({ ok: true });
}
