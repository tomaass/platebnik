# Daily health-check digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A daily Vercel Cron that emails the host a short, Claude-evaluated Czech digest of how platebník.cz is doing (people, funnel, render latency, open bugs).

**Architecture:** A secret-protected `GET /api/daily-report` (Node runtime) triggered by Vercel Cron each morning. It `gather()`s metrics from PostHog (Query API) and GitHub (fault-tolerant per source), `evaluate()`s them with Claude via the Vercel AI Gateway (falling back to a raw table if the model call fails), and `deliver()`s the result by email over the existing SMTP.

**Tech Stack:** Next.js 15 App Router (Route Handler), Vercel Cron, PostHog Query API (HogQL), `ai` SDK + Vercel AI Gateway, `nodemailer`, GitHub REST search, Vitest.

## Global Constraints

- **Czech** for the email/report copy; **English** for code comments and commits.
- Report modules live under `src/report/`; the route under `src/app/api/daily-report/`.
- Endpoint is **secret-protected**: reject unless `Authorization: Bearer ${CRON_SECRET}`; return **401** otherwise. Route is **Node.js runtime** (`export const runtime = 'nodejs'`).
- Cron schedule: **`0 5 * * *`** (UTC) — ≈07:00 Prague in summer / 06:00 in winter. Daily digest, sent even when all-green.
- Delivery: **email to `tomas@sorejs.cz`** (override via `REPORT_RECIPIENT`) from `EMAIL_FROM`, over `EMAIL_SERVER` (the existing SMTP).
- `gather()` is **fault-tolerant**: a failing data source becomes an `{ error: string }` section; the report still sends.
- If the Claude call fails, `evaluate()` **falls back** to emailing the raw metrics JSON so the morning email still arrives.
- Product events tracked: `user_registered`, `board_created`, `board_signed`, `board_paid`, `board_print_pdf`; plus `board_print_pdf.render_ms` p95.
- AI model (AI Gateway slug): **`anthropic/claude-haiku-4-5-20251001`** — cheap/fast, sufficient for a daily digest.

---

## File Structure

- **Create** `src/report/types.ts` — shared metric types (`Metrics`, `ProductMetrics`, `GithubMetrics`, `EventCounts`).
- **Create** `src/report/posthog.ts` (+ test) — PostHog Query API client: `fetchProductMetrics()`.
- **Create** `src/report/github.ts` (+ test) — `fetchOpenBugs()`.
- **Create** `src/report/gather.ts` (+ test) — `gatherMetrics(date)`, fault-tolerant orchestration.
- **Create** `src/report/evaluate.ts` (+ test) — `evaluateMetrics(metrics)` (Claude) + `rawFallback(metrics)`.
- **Create** `src/report/deliver.ts` (+ test) — `sendReportEmail(subject, text)`.
- **Create** `src/app/api/daily-report/route.ts` (+ test) — the cron endpoint.
- **Create** `vercel.json` — the cron schedule.
- **Modify** `.env.example` — document the new env vars.

---

### Task 1: Metric types + PostHog client

**Files:**
- Create: `src/report/types.ts`
- Create: `src/report/posthog.ts`
- Test: `src/report/posthog.test.ts`

**Interfaces:**
- Consumes: `fetch` (global), env `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`, `POSTHOG_API_HOST`.
- Produces:
  - `types.ts`:
    - `PRODUCT_EVENTS` tuple and `type ProductEvent`.
    - `interface EventCounts { yesterday: number; weeklyAvg: number }`
    - `interface ProductMetrics { events: Record<ProductEvent, EventCounts>; renderMsP95: number | null }`
    - `interface GithubMetrics { openIssues: number; openBugs: number }`
    - `interface Metrics { date: string; posthog: ProductMetrics | { error: string }; github: GithubMetrics | { error: string } }`
  - `posthog.ts`: `fetchProductMetrics(): Promise<ProductMetrics>`

- [ ] **Step 1: Write the types**

Create `src/report/types.ts`:

```ts
export const PRODUCT_EVENTS = [
  'user_registered',
  'board_created',
  'board_signed',
  'board_paid',
  'board_print_pdf',
] as const
export type ProductEvent = (typeof PRODUCT_EVENTS)[number]

// yesterday's count vs. the trailing 7-day daily average, for context.
export interface EventCounts {
  yesterday: number
  weeklyAvg: number
}

export interface ProductMetrics {
  events: Record<ProductEvent, EventCounts>
  renderMsP95: number | null
}

export interface GithubMetrics {
  openIssues: number
  openBugs: number
}

// A section is either its data or an {error} placeholder — gather() never throws.
export interface Metrics {
  date: string // ISO YYYY-MM-DD (Europe/Prague)
  posthog: ProductMetrics | { error: string }
  github: GithubMetrics | { error: string }
}
```

- [ ] **Step 2: Write the failing test**

Create `src/report/posthog.test.ts`:

```ts
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { fetchProductMetrics } from './posthog'

const OLD_ENV = { ...process.env }
beforeEach(() => {
  process.env.POSTHOG_PERSONAL_API_KEY = 'phx_test'
  process.env.POSTHOG_PROJECT_ID = '123'
  process.env.POSTHOG_API_HOST = 'https://eu.posthog.com'
})
afterEach(() => {
  process.env = { ...OLD_ENV }
  vi.restoreAllMocks()
})

const mockFetch = (results: unknown[][]) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ results }), { status: 200 }),
  )

describe('fetchProductMetrics', () => {
  test('parses per-event yesterday + 7-day average and render_ms p95', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      // 1st call: event counts [event, yesterday, last7]
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            results: [
              ['user_registered', 2, 14],
              ['board_created', 5, 21],
            ],
          }),
          { status: 200 },
        ),
      )
      // 2nd call: render_ms p95
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ results: [[1234.6]] }), { status: 200 }),
      )

    const m = await fetchProductMetrics()

    expect(m.events.user_registered).toEqual({ yesterday: 2, weeklyAvg: 2 })
    expect(m.events.board_created).toEqual({ yesterday: 5, weeklyAvg: 3 })
    // events with no rows default to zero
    expect(m.events.board_paid).toEqual({ yesterday: 0, weeklyAvg: 0 })
    expect(m.renderMsP95).toBe(1235) // rounded
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    // hits the project Query API with the personal key
    const [url, init] = fetchSpy.mock.calls[0]
    expect(String(url)).toBe('https://eu.posthog.com/api/projects/123/query/')
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer phx_test' })
  })

  test('throws when credentials are missing', async () => {
    delete process.env.POSTHOG_PERSONAL_API_KEY
    await expect(fetchProductMetrics()).rejects.toThrow('POSTHOG_PERSONAL_API_KEY')
  })

  test('throws on a non-OK response', async () => {
    mockFetch([]).mockResolvedValue(new Response('nope', { status: 403 }))
    await expect(fetchProductMetrics()).rejects.toThrow('PostHog query failed: 403')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/report/posthog.test.ts`
Expected: FAIL — `Failed to resolve import "./posthog"`.

- [ ] **Step 4: Write the PostHog client**

Create `src/report/posthog.ts`:

```ts
import { PRODUCT_EVENTS, type ProductEvent, type ProductMetrics, type EventCounts } from './types'

// The Query API lives on the app host (e.g. eu.posthog.com), NOT the ingestion
// host in POSTHOG_HOST (eu.i.posthog.com). Read key is a Personal API Key.
const API_HOST = process.env.POSTHOG_API_HOST ?? 'https://eu.posthog.com'

async function hogql(query: string): Promise<unknown[][]> {
  const key = process.env.POSTHOG_PERSONAL_API_KEY
  const projectId = process.env.POSTHOG_PROJECT_ID
  if (!key || !projectId) {
    throw new Error('POSTHOG_PERSONAL_API_KEY / POSTHOG_PROJECT_ID not set')
  }
  const res = await fetch(`${API_HOST}/api/projects/${projectId}/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
  })
  if (!res.ok) {
    throw new Error(`PostHog query failed: ${res.status} ${await res.text()}`)
  }
  const json = (await res.json()) as { results: unknown[][] }
  return json.results
}

export async function fetchProductMetrics(): Promise<ProductMetrics> {
  const eventList = PRODUCT_EVENTS.map((e) => `'${e}'`).join(',')
  const rows = await hogql(`
    SELECT event,
           countIf(timestamp >= now() - INTERVAL 1 DAY) AS yesterday,
           count() AS last7
    FROM events
    WHERE event IN (${eventList})
      AND timestamp >= now() - INTERVAL 7 DAY
    GROUP BY event
  `)
  const byEvent = new Map(
    rows.map((r) => [String(r[0]), { yesterday: Number(r[1]), last7: Number(r[2]) }]),
  )
  const events = Object.fromEntries(
    PRODUCT_EVENTS.map((e): [ProductEvent, EventCounts] => {
      const v = byEvent.get(e) ?? { yesterday: 0, last7: 0 }
      return [e, { yesterday: v.yesterday, weeklyAvg: v.last7 / 7 }]
    }),
  ) as Record<ProductEvent, EventCounts>

  const p95rows = await hogql(`
    SELECT quantile(0.95)(toFloat(properties.render_ms))
    FROM events
    WHERE event = 'board_print_pdf'
      AND timestamp >= now() - INTERVAL 1 DAY
      AND properties.render_ms IS NOT NULL
  `)
  const raw = p95rows[0]?.[0]
  const renderMsP95 = raw == null ? null : Math.round(Number(raw))

  return { events, renderMsP95 }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/report/posthog.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/report/types.ts src/report/posthog.ts src/report/posthog.test.ts
git commit -m "feat(report): metric types + PostHog Query API client"
```

---

### Task 2: GitHub open-bugs client

**Files:**
- Create: `src/report/github.ts`
- Test: `src/report/github.test.ts`

**Interfaces:**
- Consumes: `fetch`, env `GITHUB_TOKEN`, `GITHUB_REPO`; `GithubMetrics` from `./types`.
- Produces: `fetchOpenBugs(): Promise<GithubMetrics>`

- [ ] **Step 1: Write the failing test**

Create `src/report/github.test.ts`:

```ts
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { fetchOpenBugs } from './github'

const OLD_ENV = { ...process.env }
beforeEach(() => {
  process.env.GITHUB_TOKEN = 'ghp_test'
  process.env.GITHUB_REPO = 'tomaass/platebnik'
})
afterEach(() => {
  process.env = { ...OLD_ENV }
  vi.restoreAllMocks()
})

describe('fetchOpenBugs', () => {
  test('returns open issue and bug counts from the search API', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ total_count: 7 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ total_count: 3 }), { status: 200 }))

    const m = await fetchOpenBugs()

    expect(m).toEqual({ openIssues: 7, openBugs: 3 })
    // second query filters by label:bug
    expect(String(fetchSpy.mock.calls[1][0])).toContain('label%3Abug')
    expect((fetchSpy.mock.calls[0][1] as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer ghp_test',
    })
  })

  test('throws on a non-OK response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('bad', { status: 401 }))
    await expect(fetchOpenBugs()).rejects.toThrow('GitHub search failed: 401')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/report/github.test.ts`
Expected: FAIL — `Failed to resolve import "./github"`.

- [ ] **Step 3: Write the GitHub client**

Create `src/report/github.ts`:

```ts
import type { GithubMetrics } from './types'

const REPO = process.env.GITHUB_REPO ?? 'tomaass/platebnik'

async function countIssues(extraQualifier: string): Promise<number> {
  const token = process.env.GITHUB_TOKEN
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const q = `repo:${REPO} is:issue is:open ${extraQualifier}`.trim()
  const res = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(q)}`, {
    headers,
  })
  if (!res.ok) throw new Error(`GitHub search failed: ${res.status}`)
  return ((await res.json()) as { total_count: number }).total_count
}

export async function fetchOpenBugs(): Promise<GithubMetrics> {
  const [openIssues, openBugs] = await Promise.all([countIssues(''), countIssues('label:bug')])
  return { openIssues, openBugs }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/report/github.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/report/github.ts src/report/github.test.ts
git commit -m "feat(report): GitHub open-issue/bug counts"
```

---

### Task 3: Fault-tolerant gather()

**Files:**
- Create: `src/report/gather.ts`
- Test: `src/report/gather.test.ts`

**Interfaces:**
- Consumes: `fetchProductMetrics` from `./posthog`, `fetchOpenBugs` from `./github`, `Metrics` from `./types`.
- Produces: `gatherMetrics(date: string): Promise<Metrics>`

- [ ] **Step 1: Write the failing test**

Create `src/report/gather.test.ts`:

```ts
import { describe, expect, test, vi, beforeEach } from 'vitest'

vi.mock('./posthog', () => ({ fetchProductMetrics: vi.fn() }))
vi.mock('./github', () => ({ fetchOpenBugs: vi.fn() }))

import { fetchProductMetrics } from './posthog'
import { fetchOpenBugs } from './github'
import { gatherMetrics } from './gather'

const product = {
  events: {
    user_registered: { yesterday: 1, weeklyAvg: 1 },
    board_created: { yesterday: 2, weeklyAvg: 2 },
    board_signed: { yesterday: 3, weeklyAvg: 3 },
    board_paid: { yesterday: 4, weeklyAvg: 4 },
    board_print_pdf: { yesterday: 5, weeklyAvg: 5 },
  },
  renderMsP95: 900,
}

describe('gatherMetrics', () => {
  beforeEach(() => vi.clearAllMocks())

  test('collects all sources on the happy path', async () => {
    vi.mocked(fetchProductMetrics).mockResolvedValue(product)
    vi.mocked(fetchOpenBugs).mockResolvedValue({ openIssues: 2, openBugs: 1 })
    const m = await gatherMetrics('2026-07-03')
    expect(m).toEqual({
      date: '2026-07-03',
      posthog: product,
      github: { openIssues: 2, openBugs: 1 },
    })
  })

  test('a failing source degrades to an {error} section, others intact', async () => {
    vi.mocked(fetchProductMetrics).mockRejectedValue(new Error('PostHog down'))
    vi.mocked(fetchOpenBugs).mockResolvedValue({ openIssues: 2, openBugs: 1 })
    const m = await gatherMetrics('2026-07-03')
    expect(m.posthog).toEqual({ error: 'PostHog down' })
    expect(m.github).toEqual({ openIssues: 2, openBugs: 1 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/report/gather.test.ts`
Expected: FAIL — `Failed to resolve import "./gather"`.

- [ ] **Step 3: Write gather()**

Create `src/report/gather.ts`:

```ts
import type { Metrics } from './types'
import { fetchProductMetrics } from './posthog'
import { fetchOpenBugs } from './github'

// Run a source and turn any failure into an {error} section so one dead source
// never sinks the whole report.
const guard = async <T>(fn: () => Promise<T>): Promise<T | { error: string }> => {
  try {
    return await fn()
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function gatherMetrics(date: string): Promise<Metrics> {
  const [posthog, github] = await Promise.all([
    guard(fetchProductMetrics),
    guard(fetchOpenBugs),
  ])
  return { date, posthog, github }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/report/gather.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/report/gather.ts src/report/gather.test.ts
git commit -m "feat(report): fault-tolerant metric gathering"
```

---

### Task 4: Claude evaluation (+ raw fallback)

**Files:**
- Create: `src/report/evaluate.ts`
- Test: `src/report/evaluate.test.ts`
- Modify: `package.json` (add `ai`)

**Interfaces:**
- Consumes: `generateText` from `ai`; `Metrics` from `./types`.
- Produces:
  - `evaluateMetrics(metrics: Metrics): Promise<string>`
  - `rawFallback(metrics: Metrics): string`

- [ ] **Step 1: Install the AI SDK**

Run: `pnpm add ai`
Expected: `ai` added to `dependencies`.

(Model access is via the **Vercel AI Gateway** using a plain `provider/model` string; on Vercel it authenticates through the platform, locally via `AI_GATEWAY_API_KEY`. No provider-specific package needed.)

- [ ] **Step 2: Write the failing test**

Create `src/report/evaluate.test.ts`:

```ts
import { describe, expect, test, vi, beforeEach } from 'vitest'

vi.mock('ai', () => ({ generateText: vi.fn() }))
import { generateText } from 'ai'
import { evaluateMetrics, rawFallback } from './evaluate'
import type { Metrics } from './types'

const metrics: Metrics = {
  date: '2026-07-03',
  posthog: {
    events: {
      user_registered: { yesterday: 2, weeklyAvg: 1 },
      board_created: { yesterday: 5, weeklyAvg: 4 },
      board_signed: { yesterday: 3, weeklyAvg: 3 },
      board_paid: { yesterday: 1, weeklyAvg: 2 },
      board_print_pdf: { yesterday: 0, weeklyAvg: 1 },
    },
    renderMsP95: 1200,
  },
  github: { openIssues: 3, openBugs: 1 },
}

describe('evaluateMetrics', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns the model text and feeds it the metrics', async () => {
    vi.mocked(generateText).mockResolvedValue({ text: '🟢 vše OK\n…' } as never)
    const out = await evaluateMetrics(metrics)
    expect(out).toBe('🟢 vše OK\n…')
    const arg = vi.mocked(generateText).mock.calls[0][0] as { prompt: string }
    // the metrics JSON is embedded in the prompt
    expect(arg.prompt).toContain('"board_created"')
    expect(arg.prompt).toContain('2026-07-03')
  })

  test('falls back to the raw metrics table when the model call fails', async () => {
    vi.mocked(generateText).mockRejectedValue(new Error('gateway down'))
    const out = await evaluateMetrics(metrics)
    expect(out).toContain('surová data')
    expect(out).toContain('"renderMsP95": 1200')
  })
})

describe('rawFallback', () => {
  test('renders date + raw JSON', () => {
    const out = rawFallback(metrics)
    expect(out).toContain('2026-07-03')
    expect(out).toContain('"openBugs": 1')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/report/evaluate.test.ts`
Expected: FAIL — `Failed to resolve import "./evaluate"`.

- [ ] **Step 4: Write evaluate()**

Create `src/report/evaluate.ts`:

```ts
import { generateText } from 'ai'
import type { Metrics } from './types'

// AI Gateway model slug — cheap/fast, enough for a daily digest.
const MODEL = 'anthropic/claude-haiku-4-5-20251001'

const buildPrompt = (m: Metrics): string =>
  [
    'Jsi asistent, který každé ráno píše stručný český přehled o webu platebník.cz',
    '(appka na rozúčtování útraty v partě — hosté dělají „boardy“ s ceníkem a lidé',
    'platí QR platbou). Dostaneš JSON s metrikami za včerejšek a 7denní denní průměr.',
    '',
    'Napiš krátký ranní přehled česky:',
    '- první řádek: celkový stav jedním z 🟢 vše OK / 🟡 hlídat / 🔴 problém,',
    '- pak klíčová čísla (noví lidé, boardy vytvořené/podepsané/zaplacené, tisky)',
    '  s porovnáním na 7denní průměr,',
    '- pak sekci „Co si zaslouží pozornost“: vypíchni odchylky (nula registrací,',
    '  propad konverze created→signed→paid, render_ms p95 nad ~3000 ms, otevřené bugy).',
    'Buď stručný a konkrétní — je to glanceable ranní e-mail, ne esej.',
    'Pokud je některá sekce {"error": …}, zmiň, že se data nepodařilo načíst.',
    '',
    'Data (JSON):',
    JSON.stringify(m, null, 2),
  ].join('\n')

// Plain-text dump so the morning email still arrives if the model call fails.
export function rawFallback(m: Metrics): string {
  return `Ranní přehled platebník.cz (${m.date}) — surová data (AI vyhodnocení selhalo):\n${JSON.stringify(m, null, 2)}`
}

export async function evaluateMetrics(m: Metrics): Promise<string> {
  try {
    const { text } = await generateText({ model: MODEL, prompt: buildPrompt(m) })
    return text
  } catch {
    return rawFallback(m)
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/report/evaluate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/report/evaluate.ts src/report/evaluate.test.ts
git commit -m "feat(report): Claude evaluation with raw-metrics fallback"
```

---

### Task 5: Email delivery

**Files:**
- Create: `src/report/deliver.ts`
- Test: `src/report/deliver.test.ts`

**Interfaces:**
- Consumes: `nodemailer` (already a dependency); env `EMAIL_SERVER`, `EMAIL_FROM`, `REPORT_RECIPIENT`.
- Produces: `sendReportEmail(subject: string, text: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `src/report/deliver.test.ts`:

```ts
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'

const sendMail = vi.fn()
vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail })) },
}))
import nodemailer from 'nodemailer'
import { sendReportEmail } from './deliver'

const OLD_ENV = { ...process.env }
beforeEach(() => {
  vi.clearAllMocks()
  process.env.EMAIL_SERVER = 'smtp://user:pass@smtp.example.com:587'
  process.env.EMAIL_FROM = 'Platebnik <login@platebnik.cz>'
  delete process.env.REPORT_RECIPIENT
})
afterEach(() => {
  process.env = { ...OLD_ENV }
})

describe('sendReportEmail', () => {
  test('sends to the default recipient with the given subject/body', async () => {
    await sendReportEmail('Ranní přehled', 'tělo')
    expect(nodemailer.createTransport).toHaveBeenCalledWith('smtp://user:pass@smtp.example.com:587')
    expect(sendMail).toHaveBeenCalledWith({
      from: 'Platebnik <login@platebnik.cz>',
      to: 'tomas@sorejs.cz',
      subject: 'Ranní přehled',
      text: 'tělo',
    })
  })

  test('honours REPORT_RECIPIENT override', async () => {
    process.env.REPORT_RECIPIENT = 'someone@else.cz'
    await sendReportEmail('S', 'B')
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'someone@else.cz' }))
  })

  test('throws when EMAIL_SERVER is missing', async () => {
    delete process.env.EMAIL_SERVER
    await expect(sendReportEmail('S', 'B')).rejects.toThrow('EMAIL_SERVER')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/report/deliver.test.ts`
Expected: FAIL — `Failed to resolve import "./deliver"`.

- [ ] **Step 3: Write deliver()**

Create `src/report/deliver.ts`:

```ts
import nodemailer from 'nodemailer'

const RECIPIENT = () => process.env.REPORT_RECIPIENT ?? 'tomas@sorejs.cz'
const FROM = () => process.env.EMAIL_FROM ?? 'Platebnik <login@platebnik.cz>'

// Sends the digest over the same SMTP the magic-link emails use.
export async function sendReportEmail(subject: string, text: string): Promise<void> {
  const server = process.env.EMAIL_SERVER
  if (!server) throw new Error('EMAIL_SERVER not set')
  const transport = nodemailer.createTransport(server)
  await transport.sendMail({ from: FROM(), to: RECIPIENT(), subject, text })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/report/deliver.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/report/deliver.ts src/report/deliver.test.ts
git commit -m "feat(report): email delivery over existing SMTP"
```

---

### Task 6: Cron route + schedule + env docs

**Files:**
- Create: `src/app/api/daily-report/route.ts`
- Test: `src/app/api/daily-report/route.test.ts`
- Create: `vercel.json`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `gatherMetrics` from `@/report/gather`, `evaluateMetrics` from `@/report/evaluate`, `sendReportEmail` from `@/report/deliver`; env `CRON_SECRET`.
- Produces: `GET(req: Request): Promise<Response>`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/daily-report/route.test.ts`:

```ts
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/report/gather', () => ({ gatherMetrics: vi.fn() }))
vi.mock('@/report/evaluate', () => ({ evaluateMetrics: vi.fn() }))
vi.mock('@/report/deliver', () => ({ sendReportEmail: vi.fn() }))

import { gatherMetrics } from '@/report/gather'
import { evaluateMetrics } from '@/report/evaluate'
import { sendReportEmail } from '@/report/deliver'
import { GET } from './route'

const OLD_ENV = { ...process.env }
beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'top-secret'
})
afterEach(() => {
  process.env = { ...OLD_ENV }
})

const call = (auth?: string) =>
  GET(new Request('https://platebnik.cz/api/daily-report', auth ? { headers: { authorization: auth } } : undefined))

describe('GET /api/daily-report', () => {
  test('401 without the correct bearer secret; nothing sent', async () => {
    const res = await call('Bearer wrong')
    expect(res.status).toBe(401)
    expect(sendReportEmail).not.toHaveBeenCalled()
  })

  test('gathers, evaluates and emails on the happy path', async () => {
    vi.mocked(gatherMetrics).mockResolvedValue({ date: '2026-07-03', posthog: { error: 'x' }, github: { error: 'y' } })
    vi.mocked(evaluateMetrics).mockResolvedValue('🟢 vše OK')
    const res = await call('Bearer top-secret')
    expect(res.status).toBe(200)
    expect(gatherMetrics).toHaveBeenCalledTimes(1)
    expect(evaluateMetrics).toHaveBeenCalledTimes(1)
    const [subject, body] = vi.mocked(sendReportEmail).mock.calls[0]
    expect(subject).toContain('Platebník — ranní přehled')
    expect(body).toBe('🟢 vše OK')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/api/daily-report/route.test.ts"`
Expected: FAIL — `Failed to resolve import "./route"`.

- [ ] **Step 3: Write the route**

Create `src/app/api/daily-report/route.ts`:

```ts
import { gatherMetrics } from '@/report/gather'
import { evaluateMetrics } from '@/report/evaluate'
import { sendReportEmail } from '@/report/deliver'

// nodemailer + fetch need Node; the Claude call can take a while.
export const runtime = 'nodejs'
export const maxDuration = 60

// ISO date (YYYY-MM-DD) and a human "3. 7." label, both in Prague time.
const pragueIsoDate = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' }).format(new Date())
const pragueHumanDate = (): string =>
  new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', timeZone: 'Europe/Prague' }).format(new Date())

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  const metrics = await gatherMetrics(pragueIsoDate())
  const body = await evaluateMetrics(metrics)
  await sendReportEmail(`Platebník — ranní přehled (${pragueHumanDate()})`, body)
  return Response.json({ ok: true })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run "src/app/api/daily-report/route.test.ts"`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the cron schedule**

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/daily-report",
      "schedule": "0 5 * * *"
    }
  ]
}
```

(Vercel Cron only runs on Production deployments and sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set. `0 5 * * *` is UTC ≈ 07:00 Prague in summer.)

- [ ] **Step 6: Document the new env vars**

Append to `.env.example`:

```bash
# Daily health-check report (/api/daily-report, Vercel Cron)
POSTHOG_PERSONAL_API_KEY=
POSTHOG_PROJECT_ID=
POSTHOG_API_HOST=https://eu.posthog.com
GITHUB_TOKEN=
GITHUB_REPO=tomaass/platebnik
AI_GATEWAY_API_KEY=
CRON_SECRET=
REPORT_RECIPIENT=tomas@sorejs.cz
```

- [ ] **Step 7: Typecheck + build**

Run: `npx tsc --noEmit && pnpm build`
Expected: clean; build lists `ƒ /api/daily-report` and reports the cron.

- [ ] **Step 8: Commit**

```bash
git add "src/app/api/daily-report/route.ts" "src/app/api/daily-report/route.test.ts" vercel.json .env.example
git commit -m "feat(report): daily-report cron route + schedule + env docs"
```

---

## Final verification (whole feature)

- [ ] `pnpm test` (or `npx vitest run`) — all green (the new `src/report/*` and route tests plus the existing suite).
- [ ] `npx tsc --noEmit` — clean.
- [ ] `pnpm build` — succeeds; `/api/daily-report` present as a dynamic function; cron registered.
- [ ] **Secrets provisioned** (user action) in Vercel Project → Settings → Environment Variables (Production): `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`, `GITHUB_TOKEN`, `AI_GATEWAY_API_KEY`, `CRON_SECRET` (+ optional `POSTHOG_API_HOST`, `GITHUB_REPO`, `REPORT_RECIPIENT`). `EMAIL_SERVER`/`EMAIL_FROM` already exist.
  - PostHog Personal API Key: PostHog → Settings → Personal API Keys (scoped read on the project); Project ID: PostHog → Settings → Project.
- [ ] **Manual smoke test** after deploy: `curl -H "Authorization: Bearer $CRON_SECRET" https://platebnik.cz/api/daily-report` → confirm a real digest email arrives, then let the cron take over.

## Spec coverage check

- Hybrid Vercel Cron → route → gather/evaluate/deliver → email → Tasks 1–6. ✅
- PostHog product metrics + render_ms p95 → Task 1. ✅
- GitHub open bugs → Task 2. ✅
- Fault-tolerant gather (per-source `{error}`) → Task 3. ✅
- Claude evaluation + raw-metrics fallback → Task 4. ✅
- Email to `tomas@sorejs.cz` over existing SMTP → Task 5. ✅
- Secret-protected Node route, 401 otherwise → Task 6. ✅
- Daily cron `0 5 * * *` (≈07:00 Prague) → Task 6 (`vercel.json`). ✅
- New env/secrets documented → Task 6 (`.env.example`) + final verification. ✅
- Czech report copy → Task 4 (prompt) + Task 6 (subject). ✅
