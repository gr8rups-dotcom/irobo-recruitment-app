import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json();
  const { status } = body;
  const allowed = ["tailored", "applied", "interviewing", "offer", "closed"];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const existing = await prisma.job.findUnique({ where: { id: Number(params.id) } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const job = await prisma.job.update({
    where: { id: Number(params.id) },
    data: { status },
  });
  return NextResponse.json(job);
}
