import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

export type TailorResult = {
  match_score?: number;
  tailored_summary?: string;
  tailored_bullets?: string[];
  missing_keywords?: string[];
  interview_questions?: string[];
  talking_points?: string[];
  _raw?: string;
};

function parseModelJson(text: string): TailorResult {
  if (!text) return { _raw: "" };
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "");
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    const candidate = cleaned.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // fall through to raw
    }
  }
  return { _raw: text };
}

/**
 * Tailors a candidate's profile against a job description: rewrites/reorders
 * real experience to mirror the job's language (never invents experience),
 * estimates an ATS match score, flags missing keywords, and drafts
 * interview-prep notes.
 */
export async function tailorForJob(profileText: string, jobText: string): Promise<TailorResult> {
  const prompt = `You are an ATS resume-tailoring and interview-prep assistant.
Data item 1 is the candidate's profile/background. Data item 2 is a target job posting.
Using ONLY real experience present in the candidate's profile (never invent employers, titles, or metrics), produce a tailored application package.
Return ONLY a single valid JSON object (no markdown fences, no commentary) with exactly these fields:
{
  "match_score": <integer 0-100, ATS keyword/skill match estimate>,
  "tailored_summary": "<2-3 sentence professional summary tailored to this job>",
  "tailored_bullets": ["<5 to 8 resume bullet points, rewritten/reordered from the candidate's real background to mirror this job's language>"],
  "missing_keywords": ["<important keywords/skills from the job description not well evidenced in the candidate's background>"],
  "interview_questions": ["<5 likely interview questions for this specific role>"],
  "talking_points": ["<5 suggested talking points or STAR-style responses drawing from the candidate's real background>"]
}

Data item 1 (candidate profile):
${profileText}

Data item 2 (job posting):
${jobText}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";
  return parseModelJson(text);
}
