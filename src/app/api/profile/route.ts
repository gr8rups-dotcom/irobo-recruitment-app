import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";

function safeParse(s: string | null) {
  if (!s) return [];
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
}

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) return NextResponse.json(null);
  return NextResponse.json({
    ...profile,
    skills: safeParse(profile.skillsJson),
    education: safeParse(profile.educationJson),
    certifications: safeParse(profile.certificationsJson),
    languages: safeParse(profile.languagesJson),
    projects: safeParse(profile.projectsJson),
    experience: safeParse(profile.experienceJson),
  });
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json();
  const existing = await prisma.profile.findUnique({ where: { userId } });

  const data: any = {
    name: body.name ?? existing?.name ?? null,
    statusTag: body.statusTag ?? existing?.statusTag ?? null,
    headline: body.headline ?? existing?.headline ?? null,
    title: body.title ?? existing?.title ?? null,
    location: body.location ?? existing?.location ?? null,
    phone: body.phone ?? existing?.phone ?? null,
    email: body.email ?? existing?.email ?? null,
    photoDataUrl: body.photoDataUrl !== undefined ? body.photoDataUrl : existing?.photoDataUrl ?? null,
    background: body.background !== undefined ? body.background : existing?.background || "",
    skillsJson: body.skills !== undefined ? JSON.stringify(body.skills) : existing?.skillsJson ?? "[]",
    educationJson: body.education !== undefined ? JSON.stringify(body.education) : existing?.educationJson ?? "[]",
    certificationsJson: body.certifications !== undefined ? JSON.stringify(body.certifications) : existing?.certificationsJson ?? "[]",
    languagesJson: body.languages !== undefined ? JSON.stringify(body.languages) : existing?.languagesJson ?? "[]",
    projectsJson: body.projects !== undefined ? JSON.stringify(body.projects) : existing?.projectsJson ?? "[]",
    experienceJson: body.experience !== undefined ? JSON.stringify(body.experience) : existing?.experienceJson ?? "[]",
  };

  const profile = await prisma.profile.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
  return NextResponse.json(profile);
}
