export const PRODUCT_EVENTS = [
  'user_registered',
  'board_created',
  'board_signed',
  'board_paid',
  'board_print_pdf',
] as const
export type ProductEvent = (typeof PRODUCT_EVENTS)[number]

// yesterday's count vs. the trailing 7-day daily average, for context.
export interface EventCounts {
  yesterday: number
  weeklyAvg: number
}

export interface ProductMetrics {
  events: Record<ProductEvent, EventCounts>
  renderMsP95: number | null
}

export interface GithubMetrics {
  openIssues: number
  openBugs: number
}

// A section is either its data or an {error} placeholder — gather() never throws.
export interface Metrics {
  date: string // ISO YYYY-MM-DD (Europe/Prague)
  posthog: ProductMetrics | { error: string }
  github: GithubMetrics | { error: string }
}
