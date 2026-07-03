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
