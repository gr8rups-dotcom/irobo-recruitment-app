# IROBO — Recruitment Ecosystem (MVP)

A real, runnable Next.js app: one-time profile capture, paste-in (or upload) a
job description, get an AI-tailored CV + ATS match score + interview prep
back, and track everything on a dashboard.

**Built, not build-tested here.** This was authored directly (no `npm install`
available in the sandbox it was written in), so the first real build happens
on your machine or in Vercel's CI. The code follows standard, current
Next.js 14 App Router + Prisma conventions — if something doesn't compile,
it's most likely a version-drift issue in `package.json`, not a structural one.

## What's deliberately NOT in this MVP

- **No automated pulling from LinkedIn/Naukrigulf.** Neither has a public
  read API (see the earlier PRD). You paste or upload the job description
  yourself — same as the prototype you tried in chat.
- **No auto-apply.** The "company site" link just opens in a new tab. Nothing
  submits a form on your behalf.
- **No auth / multi-user.** This is a single-profile MVP (there's one row in
  the `Profile` table). Add auth (e.g. NextAuth) before letting more than one
  person use it.

## 1. Local setup

```bash
npm install
cp .env.example .env
# edit .env: add your ANTHROPIC_API_KEY (https://console.anthropic.com)
npx prisma db push    # creates prisma/dev.db (SQLite) from the schema
npm run dev            # http://localhost:3000
```

Go to `/` and save your profile first — `/jobs` will refuse to tailor a job
until a profile exists.

## 2. Push to your own GitHub

This was written without GitHub access, so push it yourself:

```bash
cd irobo-app
git init
git add .
git commit -m "Initial commit: IROBO recruitment ecosystem MVP"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## 3. Going to production (Vercel + your IROBO.CO domain)

**Database — this is the one required change before deploying.** SQLite
writes to a local file, and Vercel's serverless functions don't have a
persistent, writable filesystem — the SQLite approach will silently lose data
between requests in production. Before deploying:

1. Create a free Postgres database — [Neon](https://neon.tech) or
   [Supabase](https://supabase.com) both work and take about 2 minutes.
2. In `prisma/schema.prisma`, change:
   ```prisma
   datasource db {
     provider = "postgresql"   // was "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
3. Set `DATABASE_URL` to the Postgres connection string from step 1.
4. Run `npx prisma db push` once against that URL to create the tables.

**Deploy:**

1. Go to [vercel.com](https://vercel.com) → New Project → import the GitHub
   repo you pushed in step 2.
2. Add environment variables in the Vercel project settings: `DATABASE_URL`
   (your Postgres string), `ANTHROPIC_API_KEY`, optionally `ANTHROPIC_MODEL`.
3. Deploy.
4. In Vercel's project → Settings → Domains, add `irobo.co` (and/or
   `www.irobo.co`) and follow the DNS records it gives you — you'll add
   those in whatever registrar/DNS host IROBO.CO is managed through. This
   part has to happen on your end; no tool here has access to your domain's
   DNS.

## Data model

See `prisma/schema.prisma` — `Profile` (single row: name, target title,
background text) and `Job` (company, title, org URL, JD text, status,
match score, tailored summary/bullets, missing keywords, interview
questions, talking points).

## Where the AI call happens

`src/lib/anthropic.ts` — `tailorForJob()`. Called from
`POST /api/jobs` (`src/app/api/jobs/route.ts`) whenever you submit a new job
on the "Add a Job" page. Swap the model via the `ANTHROPIC_MODEL` env var if
you want higher quality than the default fast/cheap model.

## Next steps toward the fuller PRD scope

- Automated ingestion from sources that *do* have public APIs (Adzuna,
  Indeed Publisher API, Greenhouse/Lever job feeds) instead of only
  paste-in.
- Browser-extension "autofill, you submit" apply-assist (discussed in chat —
  a separate live browser-automation feature, not part of this codebase).
- Auth + multi-user support if this becomes more than a personal tool.
- Tailored-CV PDF export (currently only shown in the UI/dashboard).
