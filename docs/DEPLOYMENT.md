# IROBO — Deployment Guide

*Step-by-step instructions to take this app from your local machine to a live, public URL on Vercel with your own domain.*

These are steps for **you to run yourself** — creating accounts, entering payment details, and connecting a domain all require your own login and consent, so this guide tells you exactly what to click rather than doing it on your behalf.

## Before you start: rotate your secrets, and note the cost model

Your `.env` file's `NEXTAUTH_SECRET` was typed into this chat at some point during development. **Do not deploy that same value to production.** Anything that passed through a chat session should be treated as compromised — generate a fresh one for production: run `openssl rand -base64 32` (or use any password generator for a 32+ character random string).

**IROBO is bring-your-own-key (BYOK).** There is no shared `ANTHROPIC_API_KEY` for the whole app anymore — each signed-in user pastes their own Anthropic API key under Settings, and every extraction/tailoring call is billed to that user's own Anthropic account. This means:
- Hosting this app costs you nothing in AI usage, no matter how many people sign up.
- You instead need an `ENCRYPTION_KEY` (see step 4) — a server-only secret used to encrypt each user's saved key at rest in the database.
- If you'd rather run a single-operator instance where you cover everyone's usage, you can still paste your own key into every account's Settings — the app doesn't distinguish "owner" from "user."

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
| `ENCRYPTION_KEY` | A fresh 32-byte base64 secret — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Do **not** reuse the one from your local `.env`; production should have its own. This encrypts each user's saved Anthropic key at rest — losing/changing it makes existing saved keys undecryptable, so treat it as permanent once users are signed up. |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5-20251001` (or leave unset for the default) — this only sets which model everyone's own key calls, it is not itself a credential |
| `NEXTAUTH_URL` | `https://your-vercel-url.vercel.app` (update this again once your custom domain is live — see step 6) |
| `NEXTAUTH_SECRET` | Your new, freshly generated secret |
| `LINKEDIN_CLIENT_ID` | Optional — leave blank if not using LinkedIn sign-in |
| `LINKEDIN_CLIENT_SECRET` | Optional — leave blank if not using LinkedIn sign-in |
| `NEXT_PUBLIC_LINKEDIN_ENABLED` | `true` only if you've filled in the two LinkedIn values above, otherwise `false` |

Notice `ANTHROPIC_API_KEY` is gone from this table — IROBO doesn't use a shared key. After deploying, each user (including you) signs up and pastes their own Anthropic key under **Settings** before they can extract a profile or generate a tailored CV.

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

Because IROBO is bring-your-own-key, the Anthropic API calls on "Extract & review" and "Match & Generate" are billed to each individual user's own account, not yours — your only running costs as the operator are hosting (Vercel, likely free tier for low traffic) and the database (Neon/Supabase free tier). This is what makes it safe to open up to "other people" without a surprise bill.

Still worth knowing:
- Neon/Supabase free tiers have storage and compute limits — fine for a small number of users, worth checking their pricing pages before a large launch.
- Users without any Anthropic API key simply can't use the AI features yet — the app shows them a banner pointing at Settings, and they get a free key at console.anthropic.com themselves.
- If you ever want to go back to a single shared-key model (e.g. a small private instance you fund yourself), you can paste your own key into each account's Settings — no code changes needed for that.

## 8. Future deploys

After the first deploy, shipping updates is just:

```bash
git add .
git commit -m "your change"
git push
```

Vercel redeploys automatically on every push to `main`. If a change touched `prisma/schema.prisma`, also run `npx prisma db push` against the production `DATABASE_URL` (step 3) before or right after pushing, so the live database's tables match the new code.
