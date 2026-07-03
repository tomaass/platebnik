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
