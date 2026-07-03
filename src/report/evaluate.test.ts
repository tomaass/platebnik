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
