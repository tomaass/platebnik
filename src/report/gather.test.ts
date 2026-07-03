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
