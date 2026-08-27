import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildResumeDocx } from "@/lib/docx-generator";
import { buildResumePdf } from "@/lib/pdf-generator";
import { getCurrentUserId } from "@/lib/session";

export const runtime = "nodejs";

function safeParse(s: string | null) {
  if (!s) return [];
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const id = Number(params.id);
  const format = req.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "docx";

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job || job.userId !== userId) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) return NextResponse.json({ error: "No profile found" }, { status: 400 });

  const profileData = {
    name: profile.name || undefined,
    statusTag: profile.statusTag || undefined,
    headline: profile.headline || undefined,
    location: profile.location || undefined,
    phone: profile.phone || undefined,
    email: profile.email || undefined,
    photoDataUrl: profile.photoDataUrl || undefined,
    education: safeParse(profile.educationJson),
    certifications: safeParse(profile.certificationsJson),
    languages: safeParse(profile.languagesJson),
    projects: safeParse(profile.projectsJson),
  };

  const jobData = {
    tailoredHeadline: job.tailoredHeadline || undefined,
    tailoredSummary: job.tailoredSummary || undefined,
    skills: safeParse(job.skillsJson),
    keyAccomplishments: safeParse(job.keyAccomplishments),
    experience: safeParse(job.experienceJson),
  };

  const safeFileName = (job.company || "Company").replace(/[^a-z0-9]+/gi, "_");

  if (format === "pdf") {
    const buffer = await buildResumePdf(profileData, jobData);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Tailored_CV_${safeFileName}.pdf"`,
      },
    });
  }

  const buffer = await buildResumeDocx(profileData, jobData);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="Tailored_CV_${safeFileName}.docx"`,
    },
  });
}
