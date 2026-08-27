# IROBO — Deployment Guide

*Step-by-step instructions to take this app from your local machine to a live, public URL on Vercel with your own domain.*

These are steps for **you to run yourself** — creating accounts, entering payment details, and connecting a domain all require your own login and consent, so this guide tells you exactly what to click rather than doing it on your behalf.

## Before you start: rotate your secrets

Your `.env` file's `ANTHROPIC_API_KEY` and `NEXTAUTH_SECRET` were typed into this chat at some point during development. **Do not deploy those same values to production.** Anything that passed through a chat session should be treated as compromised:

1. Go to [console.anthropic.com](https://console.anthropic.com) → API Keys → revoke the old key → create a new one. Use the new one only in production.
2. Generate a fresh `NEXTAUTH_SECRET` for production: run `openssl rand -base64 32` (or use any password generator for a 32+ character random string).

## 1. Push the code to GitHub

If you haven't already:

```bash
cd C:\Irobo\irobo-app\irobo-app
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/gr8rups-dotcom/irobo-recruitment-app.git
git push -u origin main
```

Make sure `.env` is listed in `.gitignore` before you commit — you never want real secrets in a public (or even private) GitHub repo. Check with:

```bash
git check-ignore .env
```

If that prints nothing, add `.env` to `.gitignore` and re-commit.

## 2. Create a production Postgres database

The app now uses Postgres (SQLite doesn't work on Vercel — its filesystem isn't persistent). [Neon](https://neon.tech) and [Supabase](https://supabase.com) both have free tiers that are more than enough to start.

**Using Neon (recommended, simplest for this app):**
1. Sign up / log in at neon.tech.
2. Create a new project.
3. Copy the connection string it gives you — it looks like `postgresql://user:password@ep-xxxx.neon.tech/dbname?sslmode=require`.
4. Keep this tab open; you'll paste this value into Vercel in step 4.

## 3. Apply the database schema

From your local machine, point Prisma at the new production database temporarily and push the schema:

```bash
cd C:\Irobo\irobo-app\irobo-app
set DATABASE_URL=postgresql://user:password@ep-xxxx.neon.tech/dbname?sslmode=require
npx prisma db push
```

(On Windows PowerShell use `$env:DATABASE_URL="..."` instead of `set`.) This creates the `User`, `Profile`, and `Job` tables in your new production database. You only need to do this once per database — future schema changes get pushed the same way.

## 4. Import the project into Vercel

1. Sign up / log in at [vercel.com](https://vercel.com) with your GitHub account.
2. Click **Add New → Project**, select the `irobo-recruitment-app` repo.
3. Vercel will auto-detect Next.js — leave the build settings as default (`npm run build`, which already runs `prisma generate` first per `package.json`).
4. Before clicking Deploy, add these **Environment Variables**:

| Key | Value |
|---|---|
| `DATABASE_URL` | Your Neon/Supabase connection string from step 2 |
| `ANTHROPIC_API_KEY` | Your **new**, rotated key from the "Before you start" section |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5-20251001` (or leave unset for the default) |
| `NEXTAUTH_URL` | `https://your-vercel-url.vercel.app` (update this again once your custom domain is live — see step 6) |
| `NEXTAUTH_SECRET` | Your new, freshly generated secret |
| `LINKEDIN_CLIENT_ID` | Optional — leave blank if not using LinkedIn sign-in |
| `LINKEDIN_CLIENT_SECRET` | Optional — leave blank if not using LinkedIn sign-in |
| `NEXT_PUBLIC_LINKEDIN_ENABLED` | `true` only if you've filled in the two LinkedIn values above, otherwise `false` |

5. Click **Deploy**.

## 5. Verify it works

Once deployed, visit the Vercel URL and check:
- You can create a new account (sign up with email + password)
- Uploading a CV and clicking "Extract & review profile details" works
- Saving the profile, pasting a job description, and generating a tailored CV works
- Both Word and PDF downloads work and look correct

If something 500s, check **Vercel → your project → Deployments → (latest) → Functions** for the error log — this is the equivalent of the `npm run dev` terminal output you're used to locally.

## 6. Connect your domain (IROBO.CO)

1. In the Vercel project, go to **Settings → Domains** → add `irobo.co` (and `www.irobo.co` if you want both).
2. Vercel will show you DNS records to add (usually an `A` record pointing at Vercel's IP, or a `CNAME` for the `www` subdomain).
3. Go to wherever `IROBO.CO` is registered, open its DNS settings, and add exactly the records Vercel showed you.
4. DNS changes can take anywhere from a few minutes to a few hours to propagate. Vercel will show the domain as "Valid" once it detects the records.
5. Once the domain is live, go back to **Environment Variables** and update `NEXTAUTH_URL` to `https://irobo.co`, then redeploy (Vercel → Deployments → ⋯ → Redeploy) — NextAuth needs this to match the real domain for callbacks/cookies to work correctly.

## 7. Ongoing costs to watch

This app calls the Anthropic API on every "Extract & review" and every "Match & Generate" click. Once it's public:
- Monitor usage at [console.anthropic.com](https://console.anthropic.com) → Usage, and consider setting a spend limit there.
- Neon/Supabase free tiers have storage and compute limits — fine for a small number of users, worth checking their pricing pages before a large launch.
- If you want to cap costs further, consider adding an invite-only signup flow or a per-user monthly generation limit before a wide public launch — neither exists yet in the current build (see `ARCHITECTURE.md` §11 for extension ideas).

## 8. Future deploys

After the first deploy, shipping updates is just:

```bash
git add .
git commit -m "your change"
git push
```

Vercel redeploys automatically on every push to `main`. If a change touched `prisma/schema.prisma`, also run `npx prisma db push` against the production `DATABASE_URL` (step 3) before or right after pushing, so the live database's tables match the new code.
