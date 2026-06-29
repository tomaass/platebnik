# Testable preview deployments (dev DB + gated auth bypass) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Deferred — written 2026-06-29, not scheduled.**

**Goal:** Be able to open a PR's Vercel **Preview** deployment (e.g. PR #12) against the **dev** Neon DB and use the host-only app without burning the daily test-email quota and without weakening production auth.

**Background / root cause:** The real blocker is *not* the auth wall — it's that the Vercel **Preview** environment currently has **no environment variables at all**. As of writing, `vercel env ls` shows:

| Variable | Environments set |
|---|---|
| `DATABASE_URL` | Development, Production |
| `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `EMAIL_SERVER`, `EMAIL_FROM`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `AUTH_TRUST_HOST` | Production only |

Vercel's "Development" environment is for `vercel dev` (local), **not** Preview deployments. So a Preview deploy has no `DATABASE_URL`, no `AUTH_SECRET`, etc. → it can't reach the dev DB or run auth. Fixing the env wiring is step 1; the auth bypass (step 2) is an optional convenience on top.

**Approach:** Two independent parts.

1. **Wire Preview env vars** → points Preview at the dev Neon DB and enables auth. After this alone, normal magic-link login already works on Preview. With `EMAIL_SERVER` left **unset** on Preview, magic links print to the Vercel runtime logs (`devSendVerificationRequest` in `src/auth/config.ts`) instead of sending email — zero email quota used.
2. **Gated auth bypass** (optional, for one-click access) → a triple-locked shortcut in `requireUser()` that returns a seeded test user only on non-production deployments and only when a secret cookie matches.

**Tech Stack:** Next.js 15 (App Router, React 19), NextAuth v5 (`next-auth@beta`, `@auth/drizzle-adapter`), Drizzle ORM + Neon Postgres, TypeScript. Auth lives entirely in `src/auth/config.ts`.

## Global Constraints

- **UI copy is Czech**; code identifiers, comments, commit messages, PR text are English. (Project convention — see CLAUDE.md.)
- **Immutable / pipeline style** — no `let`, no `for`/`for...of` in app code; use Remeda or native array methods.
- **Worktree workflow** — do this work on its own branch in its own git worktree, merge via squash PR. `main` is never edited directly.
- **`requireUser()` is the single auth chokepoint.** The `(host)` layout (`src/app/(host)/layout.tsx`) and all 5 server actions in `src/app/(host)/actions.ts` funnel through it, so one change covers everything — and one bug there is an auth hole. Treat changes here with care.
- Commit messages end with the trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## Security model (why the bypass is safe)

The bypass is **triple-locked** — defense in depth, each lock independently sufficient to disable it:

1. **`VERCEL_ENV !== 'production'`** — Vercel sets `VERCEL_ENV='production'` on prod deploys. Even if the secret leaked into prod env, this guard kills the branch.
2. **`PREVIEW_BYPASS_SECRET` only added to the Preview environment** — on prod it is `undefined`, so the branch is dead regardless of guard 1.
3. **Cookie must equal the secret** — possessing the (non-secret, leak-prone) preview URL is not enough; you must know the secret to set the cookie once.

**Residual risk:** ~20 lines in the hottest auth path. Mitigated by the three locks and by keeping the bypass logic in one small, reviewable function. Preview URLs are *not* truly private (referer leakage, sharing), which is exactly why lock 3 exists.

---

## Part 1 — Wire Preview environment variables (required, no code)

- [ ] Add to the **Preview** environment on Vercel (`vercel env add <NAME> preview`, or via dashboard):
  - [ ] `DATABASE_URL` → the **dev** Neon connection string (same value as the current Development one).
  - [ ] `AUTH_SECRET` → reuse the prod value or generate a fresh one (`openssl rand -base64 32`). Independent from prod is fine.
  - [ ] `AUTH_TRUST_HOST` → `true` (NextAuth must trust the rotating preview host for callback URLs).
  - [ ] *(optional)* `UPSTASH_REDIS_REST_URL` / `_TOKEN` — only if rate-limiting code runs on the host paths being tested; otherwise skip.
  - [ ] **Leave `EMAIL_SERVER` / `EMAIL_FROM` UNSET on Preview** → magic links log to runtime output instead of emailing (no quota burn).
  - [ ] *(optional)* `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — only if testing Google login; the callback URL must be registered for the preview/branch domain in Google Cloud, so usually skip on Preview.
- [ ] Confirm migrations run against the dev DB on preview build (`scripts/migrate.mjs` / migrate-on-build) — the dev DB must have the current schema so auth tables (`users`, `sessions`, `accounts`, `verificationTokens`) exist.
- [ ] Redeploy the PR (push or re-trigger) so the new Preview env is picked up.
- [ ] **Verify (magic-link-via-logs path):**
  1. Open the **stable branch alias** (`platebnik-git-<branch>-tomaass-projects.vercel.app`) — stable across pushes, unlike the per-deploy hash, and better for the auth callback URL.
  2. Go to `/signin`, submit your email.
  3. Stream `vercel logs <deployment-url>` and copy the printed magic link.
  4. Open the link → you land authenticated on the host area.
  5. Session persists in the dev DB `sessions` table (~30 days), so you won't re-login every time.

> After Part 1, Preview is fully testable with real auth and no emails. Part 2 is purely a convenience to skip the logs dance.

---

## Part 2 — Gated auth bypass (optional convenience)

### File Structure

- **Modify** `src/auth/config.ts` — add `previewBypassUser()` and call it first in `requireUser()`.
- **(optional) Create** `src/app/preview-login/route.ts` — a tiny route that sets the bypass cookie and redirects, so you don't hand-set cookies in devtools.
- No DB schema change. No change to `actions.ts` or layouts (they already call `requireUser()`).

### Tasks

- [ ] **Seed / pick a test user in the dev DB.** Either insert a dedicated row (e.g. `preview@platebnik.cz`) into `users`, or reuse an existing dev user. Note its email; the bypass looks the user up by email so it returns a real `users.id` (FK targets in `boards`, `sessions`, etc. must resolve).
- [ ] Add `previewBypassUser()` to `src/auth/config.ts`:

  ```ts
  import { cookies } from 'next/headers'
  import { eq } from 'drizzle-orm'
  // (db, users already imported in this file)

  const previewBypassUser = async (): Promise<{ id: string; email: string } | null> => {
    // Lock 1: never on production
    if (process.env.VERCEL_ENV === 'production') return null
    // Lock 2: secret only present in the Preview environment
    const secret = process.env.PREVIEW_BYPASS_SECRET
    if (!secret) return null
    // Lock 3: caller must know the secret (set once as a cookie)
    const cookie = (await cookies()).get('preview-bypass')?.value
    if (cookie !== secret) return null

    const email = process.env.PREVIEW_USER_EMAIL
    if (!email) return null
    const user = await db.query.users.findFirst({ where: eq(users.email, email) })
    return user?.email ? { id: user.id, email: user.email } : null
  }
  ```

- [ ] Call it first in `requireUser()`:

  ```ts
  export const requireUser = async (): Promise<{ id: string; email: string }> => {
    const bypass = await previewBypassUser()
    if (bypass) return bypass

    const session = await auth()
    if (!session?.user?.id || !session.user.email) redirect('/signin')
    return { id: session.user.id, email: session.user.email }
  }
  ```

- [ ] **(optional)** Add `src/app/preview-login/route.ts` so login is one click:

  ```ts
  import { cookies } from 'next/headers'
  import { redirect } from 'next/navigation'

  export const GET = async (req: Request) => {
    const key = new URL(req.url).searchParams.get('key')
    const secret = process.env.PREVIEW_BYPASS_SECRET
    // Same locks as the bypass itself — this route is a no-op on prod / without secret.
    if (process.env.VERCEL_ENV === 'production' || !secret || key !== secret) {
      redirect('/signin')
    }
    ;(await cookies()).set('preview-bypass', secret, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    redirect('/')
  }
  ```

- [ ] Add `PREVIEW_BYPASS_SECRET` (random string) and `PREVIEW_USER_EMAIL` (the seeded user) to the **Preview** environment **only**. Generate the secret with `openssl rand -hex 16`.
- [ ] Add both new keys to `.env.example` (empty) with a comment that they are Preview-only.

### Verify (must check BOTH that it works on preview AND is dead on prod)

- [ ] **Preview, no cookie:** open the host area cold → still redirected to `/signin` (lock 3 holds).
- [ ] **Preview, after `/preview-login?key=<secret>`:** redirected to `/` and authenticated as the test user; can create/edit a board.
- [ ] **Preview, wrong key:** `/preview-login?key=nope` → redirected to `/signin`, no cookie set.
- [ ] **Production guard:** confirm `PREVIEW_BYPASS_SECRET` is **not** in the Production env, and that even with the cookie present a production deploy ignores the bypass (lock 1). Sanity-check by grepping env: it must appear only under Preview.
- [ ] `npx tsc --noEmit` clean; full test suite still green.

---

## Cleanup / follow-ups

- This is test-only infrastructure. If preview testing stops, remove the Preview env vars (and the bypass code if added) so the auth path stays minimal.
- Consider gating the bypass code behind a clearly-named comment block so a future reader doesn't mistake it for a prod feature.
- If Google login on preview is ever needed, register the branch-alias callback URL in Google Cloud and add `AUTH_GOOGLE_*` to Preview.
