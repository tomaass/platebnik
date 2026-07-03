# Daily health-check digest — design

## Purpose

Every morning, get one email summarising how platebník.cz is doing: how many
people came, whether the funnel is healthy, whether anything looks broken —
with a short LLM-written evaluation, not just a table of numbers. So problems
(a drop in signups, a latency spike, a broken funnel) surface on their own
instead of only when we happen to look.

## Architecture — hybrid (Vercel Cron + Claude)

A scheduled endpoint in our own infra, so it has native access to our env vars
(PostHog, SMTP) with no secret-juggling in an external agent runtime.

```
Vercel Cron (daily, ~morning)
  → GET /api/daily-report   (Node runtime, protected by CRON_SECRET)
      → gather()   — pull metrics from data sources (parallel, fault-tolerant)
      → evaluate() — send the gathered metrics to Claude; get back a Czech
                     digest: health banner + notable changes + "look at this"
      → deliver()  — email the digest to the host via the existing SMTP
```

Each step is a small, independently testable unit:
- **`gather()`** → returns a plain `Metrics` object (no formatting, no I/O beyond
  the fetches). Each source is wrapped so one failing source degrades to
  `{ error }` for that section instead of failing the whole report.
- **`evaluate(metrics)`** → returns the report text (calls Claude). Pure given
  its input + the model.
- **`deliver(text)`** → sends the email. The only outbound side effect.

Why not the alternatives:
- **Pure scheduled Claude cloud agent:** would need PostHog/SMTP secrets provisioned
  into an external runtime — awkward and less secure. Rejected.
- **Deterministic (no LLM):** cheap but rigid; misses the "evaluate + notice the
  unexpected" value that motivated this. Rejected.

## Data sources (v1)

**PostHog (product metrics — the core).** Query API (HogQL) with a **Personal API
Key** (the existing `POSTHOG_KEY` is a write/capture key and can't query — a new
read key + project id are required). For yesterday, and the trailing 7-day daily
average for comparison:
- `user_registered`, `board_created`, `board_signed`, `board_paid`,
  `board_print_pdf` — daily counts + 7-day avg.
- Funnel conversion: `board_created → board_signed → board_paid`.
- `board_print_pdf.render_ms` — p95 (the latency watch added earlier).

**GitHub (work/bugs).** Open issue count and anything labelled `bug`, via the
GitHub API with a token. Cheap, high-signal.

**Out of scope for v1 (note, don't silently drop):** Vercel function-level
latency/error metrics and deploy status. They need Vercel's observability API and
are lower-signal for a product digest; deploy failures already surface via
GitHub/Vercel notifications. Add in a later iteration if wanted.

## Evaluation

`evaluate()` sends the `Metrics` object to Claude (via the Anthropic API / Vercel
AI Gateway) with a prompt that asks for a **Czech** morning digest:
- A one-line health banner: **🟢 vše OK / 🟡 hlídat / 🔴 problém**.
- The key numbers (people, boards, conversion) with the day-vs-7-day-avg delta.
- A short "co si zaslouží pozornost" list — anomalies it infers (e.g. zero
  signups, a conversion drop, render_ms p95 above ~a few seconds, open bugs).
- Kept short — a glanceable morning email, not an essay.

Thresholds are guidance in the prompt, not hard-coded rules, so the model can
flag the unexpected. (If we later want hard alerts, add explicit checks in
`gather()`'s output and let the prompt lead with them.)

## Delivery

Email the digest to the host (`tomas@sorejs.cz`) via the existing Nodemailer
transport (`EMAIL_SERVER` / `EMAIL_FROM`) — the same one used for magic links.
Subject like `Platebník — ranní přehled (3. 7.)`. Plain-text or light HTML body.

## Schedule

Vercel Cron entry (in `vercel.json` or `vercel.ts`), daily. Cron schedules run in
**UTC**: `0 5 * * *` ≈ 07:00 Prague in summer (CEST, UTC+2) / 06:00 in winter
(CET, UTC+1). The one-hour DST drift is acceptable for a morning digest.

## Security

The cron route must not be publicly triggerable. Set a `CRON_SECRET` env var;
Vercel sends it as `Authorization: Bearer <CRON_SECRET>` on cron invocations. The
route returns 401 if the header doesn't match. (Standard Vercel Cron pattern.)

## Error handling

- Each data source in `gather()` is independently guarded — a failing source
  becomes an `{ error }` section; the report still sends with the rest.
- If `evaluate()` (Claude) fails, fall back to emailing the raw metrics table so
  the morning email still arrives.
- Never throw out of the route in a way that leaves no email; log failures.

## New env / secrets required

- `POSTHOG_PERSONAL_API_KEY` + `POSTHOG_PROJECT_ID` — PostHog Query API (read).
- `ANTHROPIC_API_KEY` (or AI Gateway key) — the evaluation call.
- `GITHUB_TOKEN` — GitHub API (repo read).
- `CRON_SECRET` — protect the endpoint.
- (SMTP already present: `EMAIL_SERVER`, `EMAIL_FROM`.)

## Testing

- **`gather()`**: unit-test each source's parsing with mocked API responses;
  test that one source failing yields a partial `Metrics` with an `{ error }`
  section rather than throwing.
- **`evaluate()`**: test the prompt assembly and the raw-metrics fallback on a
  simulated Claude failure (mock the model call).
- **`deliver()`**: test that it calls the transport with the right recipient /
  subject (mock Nodemailer).
- **Route**: 401 without the correct `CRON_SECRET`; 200 + "email sent" on the
  happy path with all three units mocked.
- Manual: trigger the route once with the secret and confirm a real email lands.

## Scope summary

**In (v1):** PostHog product metrics + funnel + render_ms p95, GitHub bugs, Claude
evaluation, morning email, cron schedule, secret-protected endpoint.

**Out (later):** Vercel function/deploy metrics, historical storage/dashboards,
Slack/other channels, hard-alert-only mode, per-user reports.

## Open questions for review

1. Delivery = email to `tomas@sorejs.cz` — confirm (vs. GitHub issue / Slack).
2. Cadence = daily digest even when all-green — confirm (vs. only-when-problem).
3. Provisioning the new secrets (esp. PostHog Personal API key) — you'll need to
   create them; the plan will list exact steps.
