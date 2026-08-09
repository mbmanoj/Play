# Deploying Hireright to a public URL

The app deploys to **Vercel** straight from the GitHub repo. Vercel pulls the
code and builds it on their side — nothing runs on your machine, and nothing
needs to be downloaded.

## Fastest path — demo URL, one free account (~3 minutes)

1. Go to **vercel.com** → sign in with GitHub.
2. **Add New… → Project** → import `mbmanoj/Play`.
3. Set **Root Directory** to `hireright-app` (the app lives in a subfolder).
   Framework auto-detects as **Next.js**.
4. Add one Environment Variable:
   - `AUTH_SECRET` = any long random string (signs session cookies).
5. **Deploy**.

That's it. On Vercel with no database, the app runs on an **in-memory store**
(seeded with demo data). It's fully clickable — the demo data resets when the
serverless instance goes cold, which is fine for a walkthrough.

**Client login:** open the deployed URL → it redirects to `/login` → click
**"Sign in as Demo Recruiter"** (no password — demo auth).
**Candidate portal:** visit `/portal` and sign in with any name + email.

## Durable deployment — add Postgres (so data persists)

For a demo that keeps its data, add a free Postgres and set `DATABASE_URL`:

1. In Vercel: **Storage → Create → Postgres** (or use a free
   [Neon](https://neon.tech) database).
2. Copy its connection string into an env var named `DATABASE_URL`.
3. Redeploy. The schema **auto-migrates and seeds** on first boot — no manual
   SQL.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `AUTH_SECRET` | recommended | Signs session cookies (HMAC). A dev fallback exists but set this in production. |
| `DATABASE_URL` | optional | Postgres connection string. Unset → in-memory (serverless) or file store (local). |
| `AI_PROVIDER` | optional | `anthropic` to use real Claude; anything else → deterministic mock. |
| `ANTHROPIC_API_KEY` | optional | Required only when `AI_PROVIDER=anthropic`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Enables "Continue with Google" employer sign-in. |

None are required for a working demo — it runs on mock AI + in-memory store
with zero configuration beyond `AUTH_SECRET`.

## Store selection (automatic)

`DATABASE_URL` set → **Postgres** · serverless without a DB → **in-memory** ·
local without a DB → **file store** (`.data/db.json`).
