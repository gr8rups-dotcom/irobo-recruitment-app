import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tailorForJob } from "@/lib/anthropic";

export async function GET() {
  const jobs = await prisma.job.findMany({ orderBy: { createdAt: "desc" } });
  const parsed = jobs.map((j) => ({
    ...j,
    tailoredBullets: safeParse(j.tailoredBullets),
    missingKeywords: safeParse(j.missingKeywords),
    interviewQuestions: safeParse(j.interviewQuestions),
    talkingPoints: safeParse(j.talkingPoints),
  }));
  return NextResponse.json(parsed);
}

function safeParse(s: string | null) {
  if (!s) return [];
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { company, title, orgUrl, description } = body;
  if (!description || !String(description).trim()) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }

  const profile = await prisma.profile.findUnique({ where: { id: 1 } });
  if (!profile) {
    return NextResponse.json({ error: "Save your profile before tailoring a job." }, { status: 400 });
  }

  const profileText = `Name: ${profile.name || "(not given)"}\nTarget title(s): ${profile.title || "(not given)"}\nBackground:\n${profile.background}`;
  const jobText = `Company: ${company || "(not given)"}\nJob title: ${title || "(not given)"}\nJob description:\n${description}`;

  let result;
  try {
    result = await tailorForJob(profileText, jobText);
  } catch (err: any) {
    return NextResponse.json({ error: "Tailoring failed: " + (err?.message || String(err)) }, { status: 502 });
  }

  const job = await prisma.job.create({
    data: {
      company,
      title,
      orgUrl,
      description,
      status: "tailored",
      matchScore: typeof result.match_score === "number" ? result.match_score : null,
      tailoredSummary: result.tailored_summary || null,
      tailoredBullets: JSON.stringify(result.tailored_bullets || []),
      missingKeywords: JSON.stringify(result.missing_keywords || []),
      interviewQuestions: JSON.stringify(result.interview_questions || []),
      talkingPoints: JSON.stringify(result.talking_points || []),
      rawModelOutput: result._raw || null,
    },
  });

  return NextResponse.json(job);
}
