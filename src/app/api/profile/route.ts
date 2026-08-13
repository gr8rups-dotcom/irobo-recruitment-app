import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const profile = await prisma.profile.findUnique({ where: { id: 1 } });
  return NextResponse.json(profile);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, title, background } = body;
  if (!background || !String(background).trim()) {
    return NextResponse.json({ error: "background is required" }, { status: 400 });
  }
  const profile = await prisma.profile.upsert({
    where: { id: 1 },
    update: { name, title, background },
    create: { id: 1, name, title, background },
  });
  return NextResponse.json(profile);
}
