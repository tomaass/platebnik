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
