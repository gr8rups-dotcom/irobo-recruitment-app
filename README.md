# IROBO — Recruitment Ecosystem

A multi-user recruitment tool: sign up, upload your CV once, review the
AI-extracted details, then for each job you paste in, get an AI-tailored CV
(Word + PDF, matching your original CV's layout) plus an ATS match score and
interview prep — all tracked on a dashboard.

Built with Next.js 14 (App Router), TypeScript, Prisma + Postgres, NextAuth,
and the Anthropic API.

## Bring your own API key

**There is no shared platform API key.** Every account pastes its own
Anthropic API key under **Settings** — extraction and tailoring calls are
billed to that user's own Anthropic account, encrypted at rest before it's
stored (see `src/lib/crypto.ts`). This is what makes it safe to let other
people sign up and use this app: hosting it costs the operator nothing in AI
usage no matter how many people join.

If you want a single-operator instance instead (you personally cover
everyone's usage), just paste your own key into every account's Settings —
nothing in the code distinguishes an "owner" account from any other.

## What's deliberately not in here

- **No automated pulling from job boards.** You paste or upload the job
  description yourself.
- **No auto-apply.** The "Apply" link just opens the posting in a new tab.
- **One CV template.** The generator is deliberately locked to reproducing
  your uploaded CV's own visual structure, not a generic one.

## 1. Local setup

```bash
npm install
cp .env.example .env
```

Fill in `.env`:
- `DATABASE_URL` — a free Postgres connection string ([Neon](https://neon.tech) or [Supabase](https://supabase.com), ~2 minutes to create)
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- `ENCRYPTION_KEY` — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

Then:

```bash
npx prisma db push    # creates the User/Profile/Job tables
npm run dev            # http://localhost:3000
```

Sign up, go to **Settings**, paste your own Anthropic API key (get one free
at [console.anthropic.com](https://console.anthropic.com/settings/keys)),
then upload a CV on the main page.

## 2. Data model

See `prisma/schema.prisma`:
- `User` — account + `anthropicApiKeyEncrypted` (this user's own key, encrypted)
- `Profile` — one per user, the reusable "source of truth" extracted from their CV
- `Job` — one per tailored application, with the AI's tailoring output and status tracking

## 3. Where the AI calls happen

`src/lib/anthropic.ts` — `extractProfile()` (one-time CV parsing) and
`tailorForJob()` (per-job tailoring). Both take the caller's own decrypted
API key as an argument; there's no module-level client built from a shared
env var. See `docs/ARCHITECTURE.md` §6 and §6a for the full design
reasoning, including why extraction and tailoring are deliberately separate
AI calls.

## 4. Deploying your own instance

Full step-by-step guide, including provisioning Postgres, environment
variables, and connecting a custom domain: **`docs/DEPLOYMENT.md`**.

Short version: push to your own GitHub repo, import it into
[Vercel](https://vercel.com), set `DATABASE_URL`, `NEXTAUTH_SECRET`,
`ENCRYPTION_KEY`, and `NEXTAUTH_URL` as environment variables, deploy. No
`ANTHROPIC_API_KEY` needed — that's per-user, added by each person in
Settings after they sign up.

## 5. Rebuilding this from scratch

If you want to understand *why* this app is built the way it is (the
two-stage AI design that keeps the model from fabricating CV content, the
document-generation approach that matches a real CV's exact layout, the
multi-user + BYOK retrofit, lessons learned the hard way) — read
**`docs/ARCHITECTURE.md`**. It's written as a rebuild guide for another
developer, not just a reference.
