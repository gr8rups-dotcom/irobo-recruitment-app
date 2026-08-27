import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tailorForJob } from "@/lib/anthropic";
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

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const jobs = await prisma.job.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  const mapped = jobs.map((job) => ({
    id: job.id,
    company: job.company,
    title: job.title,
    orgUrl: job.orgUrl,
    description: job.description,
    status: job.status,
    matchScore: job.matchScore,
    tailoredHeadline: job.tailoredHeadline,
    tailoredSummary: job.tailoredSummary,
    skills: safeParse(job.skillsJson),
    keyAccomplishments: safeParse(job.keyAccomplishments),
    experience: safeParse(job.experienceJson),
    tailoredBullets: safeParse(job.tailoredBullets),
    missingKeywords: safeParse(job.missingKeywords),
    interviewQuestions: safeParse(job.interviewQuestions),
    talkingPoints: safeParse(job.talkingPoints),
    createdAt: job.createdAt,
  }));
  return NextResponse.json(mapped);
}

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json();
  const description = body.description as string;
  const company = (body.company as string) || null;
  const title = (body.title as string) || null;
  const orgUrl = (body.orgUrl as string) || null;

  if (!description || !description.trim()) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }

  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) {
    return NextResponse.json(
      { error: "No profile found — extract and save your profile from a CV first." },
      { status: 400 }
    );
  }

  const structuredProfile = {
    name: profile.name || undefined,
    headline: profile.headline || undefined,
    skills: safeParse(profile.skillsJson),
    experience: safeParse(profile.experienceJson),
    background: profile.background || undefined,
  };

  let result;
  try {
    result = await tailorForJob(structuredProfile, description);
  } catch (err: any) {
    return NextResponse.json({ error: "Tailoring failed: " + (err?.message || String(err)) }, { status: 502 });
  }

  // If the model's response couldn't be parsed as JSON, tailorForJob() returns
  // an object with only `_raw` set and everything else undefined. Creating a
  // Job from that would silently produce a CV missing its Summary/Skills/
  // Accomplishments/Experience sections with no indication anything went
  // wrong — surface it as an error instead so the user can just retry.
  if (result._raw && !result.tailored_summary && !result.skills && !result.experience) {
    return NextResponse.json(
      { error: "The AI's response couldn't be read this time (a formatting glitch, not your data). Please click Match & Generate again." },
      { status: 502 }
    );
  }

  const job = await prisma.job.create({
    data: {
      userId,
      company,
      title,
      orgUrl,
      description,
      matchScore: result.match_score ?? null,
      tailoredHeadline: result.tailored_headline || null,
      tailoredSummary: result.tailored_summary || null,
      skillsJson: JSON.stringify(result.skills || []),
      keyAccomplishments: JSON.stringify(result.key_accomplishments || []),
      experienceJson: JSON.stringify(result.experience || []),
      tailoredBullets: JSON.stringify(result.tailored_bullets || []),
      missingKeywords: JSON.stringify(result.missing_keywords || []),
      interviewQuestions: JSON.stringify(result.interview_questions || []),
      talkingPoints: JSON.stringify(result.talking_points || []),
      rawModelOutput: result._raw || null,
    },
  });

  return NextResponse.json({
    id: job.id,
    company: job.company,
    title: job.title,
    orgUrl: job.orgUrl,
    matchScore: job.matchScore,
    tailoredHeadline: job.tailoredHeadline,
    tailoredSummary: job.tailoredSummary,
    skills: safeParse(job.skillsJson),
    keyAccomplishments: safeParse(job.keyAccomplishments),
    experience: safeParse(job.experienceJson),
    tailoredBullets: safeParse(job.tailoredBullets),
    missingKeywords: safeParse(job.missingKeywords),
    interviewQuestions: safeParse(job.interviewQuestions),
    talkingPoints: safeParse(job.talkingPoints),
  });
}
