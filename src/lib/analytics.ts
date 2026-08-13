import { PostHog } from 'posthog-node'

// Server-side product analytics via PostHog. Fires funnel events from Server
// Actions and auth callbacks — accurate, ad-block-proof, cookieless (no client
// identifiers, no consent banner needed). Complements Vercel Web Analytics,
// which covers anonymous traffic/pageviews.

type AnalyticsEvent =
  | 'user_registered'
  | 'board_created'
  | 'board_signed'
  | 'board_demo_signed'
  | 'board_paid'
  | 'board_print_pdf'
  | 'board_archived'
  | 'board_deleted'

type Properties = Record<string, string | number | boolean | null | undefined>

let _client: PostHog | null = null

const getClient = (): PostHog | null => {
  const key = process.env.POSTHOG_KEY

  if (!key) {
    return null
  }

  if (_client !== null) {
    return _client
  }

  _client = new PostHog(key, {
    host: process.env.POSTHOG_HOST ?? 'https://eu.i.posthog.com',
  })

  return _client
}

let _warnedOnce = false

/**
 * Record a funnel event. Never throws — analytics must not break a user flow.
 * Uses `captureImmediate` so the event is flushed before the serverless
 * function suspends (no reliance on a background flush timer).
 */
export const track = async (
  event: AnalyticsEvent,
  distinctId: string,
  properties?: Properties,
): Promise<void> => {
  const client = getClient()

  if (client === null) {
    if (!_warnedOnce) {
      console.warn('[analytics] POSTHOG_KEY not set — event tracking disabled')
      _warnedOnce = true
    }
    return
  }

  try {
    await client.captureImmediate({ distinctId, event, properties })
  } catch (error) {
    console.error('[analytics] failed to capture', event, error)
  }
}
