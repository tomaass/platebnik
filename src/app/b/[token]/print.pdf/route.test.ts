import { describe, expect, test, vi, beforeEach } from 'vitest'

vi.mock('@/db/boards', () => ({ getBoardMeta: vi.fn() }))
vi.mock('@/lib/analytics', () => ({ track: vi.fn() }))

import { getBoardMeta } from '@/db/boards'
import { track } from '@/lib/analytics'
import { GET } from './route'

const call = (token: string) =>
  GET(new Request(`https://platebnik.cz/b/${token}/print.pdf`), {
    params: Promise.resolve({ token }),
  })

describe('GET /b/[token]/print.pdf', () => {
  beforeEach(() => vi.clearAllMocks())

  test('returns a PDF for a known board and tracks the event', async () => {
    vi.mocked(getBoardMeta).mockResolvedValue({ title: 'Táborák u Bédi', theme: 'sunset' })
    const res = await call('ABC123')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toContain('platebnik-taborak-u-bedi.pdf')
    const bytes = Buffer.from(await res.arrayBuffer())
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('%PDF')
    expect(track).toHaveBeenCalledWith('board_print_pdf', 'ABC123', { token: 'ABC123' })
  })

  test('returns 404 for an unknown board', async () => {
    vi.mocked(getBoardMeta).mockResolvedValue(null)
    const res = await call('nope')
    expect(res.status).toBe(404)
    expect(track).not.toHaveBeenCalled()
  })
})
