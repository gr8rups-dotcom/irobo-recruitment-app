# IROBO — Architecture & Rebuild Guide

*A step-by-step technical walkthrough of how this app is built, written so another developer could rebuild it from scratch.*

## 1. What this app does

IROBO is a personal recruitment tool. A user uploads their real CV once. The app extracts every field from it into a structured, editable profile the user reviews and corrects. From then on, for each job posting they paste in, the app calls an AI model to honestly reword their real experience to mirror that job's language — never inventing skills or history — and generates a tailored CV as a matching Word or PDF file, styled to look like the user's own original CV layout (photo, header block, section rules, fonts) rather than a generic template.

The core design decision that shapes everything else: **separate "capture the truth" from "reword the truth."** Extraction happens once and is reviewed by a human. Tailoring happens per job and only touches a narrow, clearly-labeled set of rewordable fields. This is what keeps the AI from silently fabricating or dropping real CV content — a failure mode this project hit repeatedly before that separation existed.

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14, App Router | Single codebase for pages + API routes (Route Handlers), easy Vercel deploy |
| Language | TypeScript | Shared types between client and server code |
| Database | Postgres via Prisma ORM | Prisma gives type-safe queries; Postgres is required for serverless hosting (SQLite's file-based storage doesn't survive on Vercel's read-only filesystem) |
| Auth | NextAuth v4 | Credentials (email + bcrypt password) provider, plus an optional LinkedIn OpenID Connect provider |
| AI | Anthropic API (`@anthropic-ai/sdk`), Claude Haiku by default | Fast/cheap model is enough for extraction and rewording; swap `ANTHROPIC_MODEL` for a stronger model if needed. **Bring-your-own-key**: there is no shared platform key — every call is billed to the signed-in user's own Anthropic account (see §6a) |
| Document parsing | `pdf-parse` (PDF → text), `mammoth` (.docx → text) | Used both for CV upload and job description upload |
| Document generation | `docx` (npm) for Word, `pdfkit` for PDF | Two independent renderers kept structurally in sync by hand — see §7 |

## 3. High-level request flow

```
Browser (React client components)
   │  fetch()
   ▼
Next.js API Route Handlers (src/app/api/**/route.ts)
   │                              │
   ▼                              ▼
Prisma Client  ──────────►  Postgres (User / Profile / Job tables)
   │
   ▼
Anthropic API (extraction + tailoring calls only — not on every page load)
   │
   ▼
docx-generator.ts / pdf-generator.ts  (server-side, returns a Buffer)
   │
   ▼
NextResponse with Content-Disposition: attachment  →  browser downloads the file
```

Nothing about document generation happens in the browser — the client only ever receives a finished file. This matters because both `docx` and `pdfkit` are Node libraries with filesystem dependencies (pdfkit reads its own bundled font files) that don't run in a browser or edge runtime; every route touching them is pinned to `export const runtime = "nodejs"`.

## 4. Data model

```prisma
model User {
  id                       String   @id @default(cuid())
  email                    String   @unique
  passwordHash             String?  // null for LinkedIn-only accounts
  anthropicApiKeyEncrypted String?  // this user's own key, AES-256-GCM encrypted — see §6a
  profile                  Profile?
  jobs                     Job[]
}

model Profile {          // one per user — the reusable "source of truth"
  id                 String @id @default(cuid())
  userId             String @unique
  name, headline, statusTag, location, phone, email, photoDataUrl
  background         String   // raw CV text, kept verbatim
  skillsJson, educationJson, certificationsJson, languagesJson,
  projectsJson, experienceJson   // each a JSON-encoded array, extracted once
}

model Job {             // one per tailored application
  id                 Int @id @default(autoincrement())
  userId             String
  company, title, orgUrl, description
  status             String  // tailored | applied | interviewing | offer | closed
  matchScore         Int?
  tailoredHeadline, tailoredSummary
  skillsJson, keyAccomplishments, experienceJson, tailoredBullets,
  missingKeywords, interviewQuestions, talkingPoints
  rawModelOutput     String?  // fallback if the AI's JSON didn't parse — see §6
}
```

Design notes:
- Every structured list (skills, education, experience, etc.) is stored as a **JSON string column**, not a relational child table. This was a deliberate simplicity trade-off — the data is always read/written as a whole blob per profile or job, never queried field-by-field, so normalizing it would add migration complexity for no query benefit.
- `Job.experienceJson` duplicates `Profile.experienceJson` structurally but holds the **tailored** (reworded) version for that specific job, while `Profile.experienceJson` stays the **verbatim master copy**. Document generation reads company/title/dates from the tailored copy (which the AI is instructed to echo back unchanged) and prose from the tailored bullets.
- `rawModelOutput` exists because early versions silently produced broken CVs when the AI's JSON response failed to parse — see §6 for the real bug this caught.

## 5. Authentication design

NextAuth uses JWT sessions (no server-side session table needed). Two providers:

1. **Credentials** (`src/lib/auth.ts`) — email + password. Passwords are hashed with `bcryptjs` (pure-JS, no native compilation — important if you ever build in a different environment than you deploy to; see §9). `authorize()` looks up the `User` by email and compares the hash.
2. **LinkedIn** (OpenID Connect) — optional. Only enabled in the UI when `NEXT_PUBLIC_LINKEDIN_ENABLED=true` is set, since it requires a LinkedIn Developer App configured for the newer "Sign In with LinkedIn using OpenID Connect" product specifically (the older OAuth2 scopes were retired in 2023).

Because two different providers can authenticate the same person, the `jwt` callback **upserts a `User` row keyed by email** on every sign-in and stores that row's id as `token.userId`. The `session` callback copies it to `session.user.id`. Every API route calls a single helper, `getCurrentUserId()` (`src/lib/session.ts`), which wraps `getServerSession(authOptions)` — this is the only place "how do I know who's asking" is implemented, so every route has one consistent, auditable check instead of five slightly different ones.

`src/middleware.ts` also gates every route except `/login`, `/api/auth/*`, and static assets at the edge, so even a route that forgot the explicit check would still redirect an unauthenticated request.

## 6. The two-stage AI design

**Stage 1 — `extractProfile(cvText)`** (`src/lib/anthropic.ts`): runs once per CV upload. The prompt instructs the model to copy every field **character-for-character** — name, headline, contact info, categorized skills, education, certifications, languages, projects, and full work history — into a fixed JSON shape. Nothing is reworded here. The result populates a review form the user must look at and correct before saving; this human-in-the-loop step is what catches CV-parsing mistakes before they propagate into every future generated CV.

**Stage 2 — `tailorForJob(profile, jobText)`**: runs once per job description. The prompt is split explicitly into two field lists:

- **STRICT VERBATIM** — `experience[].title/company/location/dates`. The model is told these are historical facts and must never be reworded.
- **REWORDABLE** — `tailored_headline` (the candidate's top-of-CV title, which *can* shift to mirror a job's seniority, e.g. "Data Analyst" → "Senior Data Analyst", but only as far as the candidate's real background honestly supports), `tailored_summary`, `skills` (selection/reordering only, never new items), `key_accomplishments`, and `experience[].bullets` (reworded to mirror the job posting's language).

This split exists because early versions let the model regenerate the *entire* resume from scratch per job, which silently dropped or altered job titles, entire sections (a GitHub projects section vanished more than once), and the candidate's photo. Splitting "what must stay exactly the same" from "what may be reworded" — and only ever rendering the verbatim fields from the saved Profile at document-generation time, never from the AI's free-form output — closed that failure mode structurally instead of by prompting harder.

**A real bug worth knowing about:** the model occasionally emits a literal, unescaped `"` inside a JSON string value (e.g., quoting a rhetorical question inside a sentence), which breaks `JSON.parse` even though the response is otherwise well-formed. `parseJson()` now does a second-pass repair — walking the text and treating a quote as an embedded character rather than a string terminator unless it's followed by a JSON delimiter (`, } ] :`) — before giving up. If parsing still fails, the API route returns a clear error instead of silently creating a Job with empty Summary/Skills/Experience fields (which is exactly what used to happen, and is hard to notice from the UI alone).

## 6a. Bring-your-own-key: how AI cost is kept off the operator

Once this app is public, "who pays for the AI calls" becomes a real question — a single shared `ANTHROPIC_API_KEY` scales its cost with every signup, with no built-in ceiling. IROBO avoids this by never having a shared key at all:

- `User.anthropicApiKeyEncrypted` stores each user's own key, encrypted with AES-256-GCM (`src/lib/crypto.ts`) using a server-only `ENCRYPTION_KEY` env var (32 random bytes, base64-encoded, generated once per environment — never the same value in local `.env` and production).
- `extractProfile()` and `tailorForJob()` (`src/lib/anthropic.ts`) no longer build a module-level Anthropic client from `process.env`. They take the caller's decrypted API key as their first argument and construct a fresh client per call.
- The API routes that call them (`/api/extract-profile`, `/api/jobs`) load the signed-in user's row, decrypt `anthropicApiKeyEncrypted`, and pass it through. If it's unset, they return `400 { error, code: "NO_API_KEY" }` instead of failing deep inside an AI call — the client UI (`src/app/page.tsx`) checks for that code and shows a banner linking to `/settings`.
- `/api/settings/api-key` (GET/POST/DELETE) is the only place a key is written or read. GET never returns the decrypted value — only `{ hasKey: boolean }` — so the browser never sees a saved key again after the user pastes it once. POST validates the key with a 1-token real API call before saving, so a typo is caught immediately rather than surfacing as a confusing failure later.

This means the app's operator pays only for hosting (Vercel) and the database (Neon/Supabase) — AI usage scales with adoption but never touches the operator's wallet. If you'd rather run a single-operator instance funded by you, nothing stops you from pasting your own key into every account's Settings; the schema and routes don't distinguish an "owner" account from any other.

## 7. Document generation — matching a real CV's exact template

Both `docx-generator.ts` and `pdf-generator.ts` render the **same structure**, independently, because the two output libraries have completely different APIs:

- Photo + name/status-tag/headline header block (a borderless table in docx; explicit x/y coordinates in pdfkit)
- Centered contact line
- A horizontal rule under the header and under every section heading (a paragraph `border` in docx; a manually drawn `moveTo/lineTo/stroke()` line in pdfkit)
- All-caps section titles in a consistent accent color
- A "Name | Title" footer repeated on every page (docx's built-in `Footer`; pdfkit requires `bufferPages: true` + a post-pass over every page via `bufferedPageRange()`/`switchToPage()`, because drawing footer text too close to the bottom margin can otherwise trigger pdfkit to silently insert a blank extra page)

**Page count is a real, measurable constraint**, not a cosmetic one — a CV spilling from 2 pages to 3 is a genuine defect. Don't guess at spacing/margin values and hope; verify:

```bash
# PDF: render directly, then check the page count
node -e "require('pdf-parse')(fs.readFileSync('out.pdf')).then(d => console.log(d.numpages))"

# DOCX: convert with a real renderer, then check the same way
soffice --headless --convert-to pdf out.docx
```

The final tuning that got a dense, 10+-year, 5-role CV down to 2 pages consistently in both formats: 34pt page margins, a 10pt cap on the name/headline/section headings, and 9pt for everything else — with the docx and pdfkit values kept numerically in sync so the two formats don't drift apart again.

## 8. File structure

```
prisma/schema.prisma          Data model (§4)
src/lib/
  auth.ts                     NextAuth config (§5)
  session.ts                  getCurrentUserId() helper
  db.ts                       Prisma client singleton
  anthropic.ts                extractProfile() + tailorForJob() + JSON repair (§6) — takes each caller's own API key (§6a)
  crypto.ts                   encrypt()/decrypt() for each user's saved API key (§6a)
  docx-generator.ts           Word CV renderer (§7)
  pdf-generator.ts            PDF CV renderer (§7)
src/app/
  login/page.tsx              Sign in / sign up
  page.tsx                    Main flow: upload CV → review → paste JD → generate
  dashboard/page.tsx           History of tailored jobs, status tracking
  settings/page.tsx           Paste/remove your own Anthropic API key (§6a)
  api/
    auth/[...nextauth]/route.ts   NextAuth handler
    auth/signup/route.ts          Password account creation
    profile/route.ts              GET/POST the current user's Profile
    extract-profile/route.ts      One-shot CV → structured fields
    parse-document/route.ts       PDF/DOCX → plain text (shared by CV + JD upload)
    jobs/route.ts                 GET list / POST tailor-and-create
    jobs/[id]/route.ts            PATCH status
    jobs/[id]/download/route.ts   Generate + stream the Word/PDF file
    settings/api-key/route.ts     GET (hasKey only) / POST (validate+save) / DELETE (§6a)
src/middleware.ts              Route protection
src/types/next-auth.d.ts       Session/JWT type augmentation
```

## 9. Step-by-step build order

If rebuilding from scratch, this is the order that avoids backtracking:

1. **Scaffold**: `npx create-next-app` (TypeScript, App Router), add Prisma, write the `User`/`Profile`/`Job` schema, connect a Postgres instance (a free Neon or Supabase project works from day one — don't start on SQLite if you'll deploy to a serverless host, you'll just have to migrate later).
2. **Auth**: NextAuth with a Credentials provider first (simplest to test locally); add LinkedIn later, behind a feature flag.
3. **CV upload + extraction**: file upload → `parse-document` (pdf-parse/mammoth) → `extractProfile()` → a review form the user must explicitly save. Don't skip the review step even in a v1 — it's the main defense against silent extraction errors.
4. **Job tailoring**: paste/upload a JD → `tailorForJob()` → persist a `Job` row.
5. **Document generation**: get one format working end-to-end (docx is more forgiving to iterate on since Word renders imperfect layouts more gracefully than a hand-rolled PDF), then build the second renderer to the same structure.
6. **Download routes + dashboard**: wire up file downloads and a history view with status tracking.
7. **Multi-user hardening**: only after the single-user flow works, add the `userId` foreign keys, scope every query, and add real password hashing. Retrofitting this after the fact (which is what happened in this project) is very mechanical but easy to miss a route — grep for every Prisma query and confirm each one filters by the current user.
8. **Bring-your-own-key (§6a)**: before opening the app to real outside users, remove any shared `ANTHROPIC_API_KEY` and switch to per-user encrypted keys — otherwise every signup adds directly to your own AI bill with no ceiling. This is also mechanical (add the encrypted column, thread the key through the two AI functions, add the settings route/page) but easy to skip if you're used to the single-user version working fine with a shared key.
9. **Deploy**: see `DEPLOYMENT.md`.

## 10. Lessons learned the hard way

These are specific, real bugs hit while building this — worth knowing before you hit them yourself:

- **Prisma Client goes stale silently.** After editing `schema.prisma`, TypeScript will show `Property 'x' does not exist on PrismaClient` until you run `prisma generate` (or `prisma db push`, which runs it automatically). This looks like a code bug; it's actually just an out-of-date generated client.
- **Never run `npm install` / `prisma generate` from a different OS than the one that will run the app.** Prisma's query engine and any native-binding npm packages compile per-platform; generating on Linux and running on Windows (or vice versa) silently breaks the app. Stick to pure-JS packages (like `bcryptjs` over `bcrypt`) when you have a choice, for exactly this reason.
- **pdfkit bundles its own font files and reads them from disk at runtime** using relative paths — Next.js's webpack bundling for API routes breaks that lookup unless `pdfkit` is marked external (`experimental.serverComponentsExternalPackages: ["pdfkit"]` in `next.config.js`).
- **An AI model's JSON output is not guaranteed valid JSON**, even when it looks right. Build a repair/fallback path (§6) and treat "parsed but suspiciously empty" as a failure state you surface to the user, not one you silently persist.
- **Verify page count and layout by actually rendering the file**, not by reading the generation code and reasoning about it. A `pdf-parse` page count check and a LibreOffice headless conversion are cheap and catch real regressions that code review alone won't.

## 11. Ideas for extending this

- Multiple CV templates the user can choose between (the current template is deliberately locked to one specific visual structure)
- Cover letter generation from the same Profile + Job data
- A key-rotation reminder or "test my saved key" button in Settings, since a revoked/expired key otherwise only surfaces as a failed generation
- Re-enabling LinkedIn import of the initial CV data, not just sign-in
- Email verification / password reset flow (the current signup is intentionally minimal)
