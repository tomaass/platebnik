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
  // ClickHouse quantile() over zero rows returns nan (a value, not SQL NULL);
  // treat both null and NaN as "no data" so renderMsP95 stays whole-or-null.
  const parsed = raw == null ? NaN : Number(raw)
  const renderMsP95 = Number.isNaN(parsed) ? null : Math.round(parsed)

  return { events, renderMsP95 }
}
