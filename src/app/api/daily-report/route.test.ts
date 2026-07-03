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
