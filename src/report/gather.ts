import type { Metrics } from './types'
import { fetchProductMetrics } from './posthog'
import { fetchOpenBugs } from './github'

// Run a source and turn any failure into an {error} section so one dead source
// never sinks the whole report.
const guard = async <T>(fn: () => Promise<T>): Promise<T | { error: string }> => {
  try {
    return await fn()
  } catch (e) {
    console.error('[daily-report] metric source failed:', e)
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
