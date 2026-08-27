import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

export type SkillCategory = { category: string; skills: string[] };
export type ExperienceEntry = { title: string; company: string; location: string; dates: string; bullets: string[] };
export type ProjectEntry = { title: string; link: string; description: string };

export type ExtractedProfile = {
  name?: string;
  status_tag?: string;
  headline?: string;
  location?: string;
  phone?: string;
  email?: string;
  skills?: SkillCategory[];
  education?: string[];
  certifications?: string[];
  languages?: string[];
  projects?: ProjectEntry[];
  experience?: ExperienceEntry[];
  _raw?: string;
};

export type TailorResult = {
  match_score?: number;
  tailored_headline?: string;
  tailored_summary?: string;
  skills?: SkillCategory[];
  key_accomplishments?: string[];
  experience?: ExperienceEntry[];
  tailored_bullets?: string[];
  missing_keywords?: string[];
  interview_questions?: string[];
  talking_points?: string[];
  _raw?: string;
};

// The model occasionally writes a literal quotation mark inside a string
// value (e.g. quoting a question verbatim in a talking-points sentence)
// without escaping it, which breaks JSON.parse even though the response is
// otherwise well-formed. This walks the text tracking whether we're inside a
// JSON string and, when a quote doesn't look like a real string terminator
// (i.e. it isn't followed by a JSON delimiter), treats it as embedded text
// and escapes it instead of ending the string there.
function repairUnescapedQuotes(jsonText: string): string {
  let result = "";
  let inString = false;
  let i = 0;
  const n = jsonText.length;
  while (i < n) {
    const ch = jsonText[i];
    if (inString) {
      if (ch === "\\" && i + 1 < n) {
        result += ch + jsonText[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') {
        let j = i + 1;
        while (j < n && /\s/.test(jsonText[j])) j++;
        const next = jsonText[j];
        if (next === undefined || [",", "}", "]", ":"].includes(next)) {
          result += ch;
          inString = false;
          i++;
          continue;
        }
        result += '\\"';
        i++;
        continue;
      }
      result += ch;
      i++;
      continue;
    } else {
      if (ch === '"') inString = true;
      result += ch;
      i++;
    }
  }
  return result;
}

function parseJson<T>(text: string): T {
  if (!text) return { _raw: "" } as unknown as T;
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "");
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    const candidate = cleaned.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate) as T;
    } catch {
      try {
        return JSON.parse(repairUnescapedQuotes(candidate)) as T;
      } catch {
        // fall through to raw
      }
    }
  }
  return { _raw: text } as unknown as T;
}

/**
 * One-time extraction: reads the candidate's raw CV text and pulls out every
 * structured field verbatim (name, headline, contact, categorized skills,
 * education, certifications, projects, experience). Used once when a CV is
 * uploaded so the user can review/correct before saving their Profile.
 */
export async function extractProfile(cvText: string): Promise<ExtractedProfile> {
  const prompt = `You are a resume-parsing assistant. Extract structured fields from the candidate's CV text below.
Copy every field VERBATIM (character-for-character) from the source text — do not rephrase, summarize, standardize, or invent anything. If a field is not present, use an empty string or empty array.
Return ONLY a single valid JSON object (no markdown fences, no commentary) with exactly these fields:
{
  "name": "<candidate's full name>",
  "status_tag": "<short status note next to the name if present, e.g. 'Immediate Joiner' — else empty string>",
  "headline": "<the professional headline/title line under the name, verbatim>",
  "location": "<city/country>",
  "phone": "<phone number>",
  "email": "<email address>",
  "skills": [{ "category": "<verbatim category label as grouped in the CV, e.g. 'Business Analysis'>", "skills": ["<verbatim skill items in that category>"] }],
  "education": ["<one verbatim line per education entry, e.g. 'MBA - Supply Chain Management | NMIMS, Mumbai | 2022-2024'>"],
  "certifications": ["<verbatim certification names, one per item>"],
  "languages": ["<verbatim language + proficiency if given, e.g. 'English - Fluent'>"],
  "projects": [{ "title": "<verbatim project title>", "link": "<verbatim URL if present, else empty string>", "description": "<verbatim project description>" }],
  "experience": [{ "title": "<verbatim job title>", "company": "<verbatim employer>", "location": "<verbatim location if present>", "dates": "<verbatim date range>", "bullets": ["<verbatim bullet points for this role>"] }]
}
If the CV groups skills as a flat list rather than categories, put them all under a single category called "Skills".

Candidate CV text:
${cvText}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";
  return parseJson<ExtractedProfile>(text);
}

/**
 * Per-job tailoring. Takes the candidate's already-structured profile (real
 * skills/experience, verbatim) plus a job posting, and returns only the
 * parts that should change per job: summary emphasis, skill selection/order,
 * which accomplishments to lead with, and reworded experience bullets.
 * Company/title/location/dates are echoed back verbatim, never reworded.
 */
export async function tailorForJob(
  profile: { name?: string; headline?: string; skills?: SkillCategory[]; experience?: ExperienceEntry[]; background?: string },
  jobText: string
): Promise<TailorResult> {
  const skillsText = (profile.skills || []).map((s) => `${s.category}: ${s.skills.join(", ")}`).join("\n");
  const experienceText = (profile.experience || [])
    .map((e) => `${e.title} | ${e.company} | ${e.location} | ${e.dates}\n` + (e.bullets || []).map((b) => "- " + b).join("\n"))
    .join("\n\n");

  const prompt = `You are an ATS resume-tailoring and interview-prep assistant.
Data item 1 is the candidate's real skills and work experience. Data item 2 is a target job posting.

STRICT VERBATIM FIELDS — copy these character-for-character from Data item 1. Do NOT rephrase, rename, or "optimize" them. These are historical employment facts and must never change:
- experience[].title
- experience[].company
- experience[].location
- experience[].dates

REWORDABLE — tailor these to the job posting's language and keywords, but stay truthful (never invent skills, employers, metrics, or achievements not present in Data item 1):
- tailored_headline — the candidate's top-of-CV professional title/headline (shown under their name, distinct from any single employer's job title in the Experience section). Reword this to mirror the seniority and title language of THIS job posting, as long as it honestly reflects the candidate's real level and scope — e.g. if the candidate's current headline is "Data Analyst" and the job posting is for a "Senior Data Analyst" and the candidate's real experience genuinely supports that level, the tailored headline should read "Senior Data Analyst". Do not invent a title the candidate's real background doesn't support (e.g. don't call a Data Analyst a "Head of Data" just because the JD asks for one). If Data item 1's headline already fits, keep it close to as-is.
- tailored_summary — write a FULL, detailed 3-5 sentence summary covering the candidate's real breadth of tools/experience relevant to this job. Do NOT compress or minimize it versus what's in Data item 1.
- skills — select and reorder from the candidate's real categorized skills, prioritizing what's most relevant to this job; keep the same category labels; do not invent new skills.
- key_accomplishments — select and lightly reword the candidate's most relevant real achievements for this job.
- experience[].bullets — reworded/reordered from the candidate's real bullets for that role to mirror this job's language and keywords.

Keyword optimization rule: when the candidate's real experience genuinely demonstrates something the job posting asks for, rephrase that experience (in the rewordable fields only) using the job posting's own terminology wherever it honestly applies. Only list a term under missing_keywords if the candidate's background shows no reasonable real equivalent at all.

Return ONLY a single valid JSON object (no markdown fences, no commentary) with exactly these fields. This must be strictly valid JSON: if any string value needs to quote a phrase or question verbatim, use single quotes ('like this') instead of double quotes inside the string, since an unescaped double quote inside a string value breaks JSON parsing.
{
  "match_score": <integer 0-100, ATS keyword/skill match estimate after honest keyword reframing>,
  "tailored_headline": "<candidate's professional title/headline, reworded to mirror this job's title/seniority where honestly supported>",
  "tailored_summary": "<full 3-5 sentence professional summary, covering real breadth, tailored to this job>",
  "skills": [{ "category": "<verbatim category label>", "skills": ["<selected/reordered real skills>"] }],
  "key_accomplishments": ["<5 to 8 top real achievements, selected/reworded for this job>"],
  "experience": [{ "title": "<verbatim>", "company": "<verbatim>", "location": "<verbatim>", "dates": "<verbatim>", "bullets": ["<reworded bullets for this role>"] }],
  "tailored_bullets": ["<5 to 8 top resume bullets overall, for quick preview>"],
  "missing_keywords": ["<important JD keywords with no reasonable real equivalent>"],
  "interview_questions": ["<5 likely interview questions for this specific role>"],
  "talking_points": ["<5 suggested talking points or STAR-style responses from real background>"]
}

Data item 1 (candidate's real skills and experience):
Name: ${profile.name || "(not given)"}
Headline: ${profile.headline || "(not given)"}
Skills:
${skillsText || "(not given)"}
Experience:
${experienceText || "(not given)"}
${profile.background ? "\nAdditional background notes:\n" + profile.background : ""}

Data item 2 (job posting):
${jobText}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";
  return parseJson<TailorResult>(text);
}