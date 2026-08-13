import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { status } = body;
  const allowed = ["tailored", "applied", "interviewing", "offer", "closed"];
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  const job = await prisma.job.update({
    where: { id: Number(params.id) },
    data: { status },
  });
  return NextResponse.json(job);
}
