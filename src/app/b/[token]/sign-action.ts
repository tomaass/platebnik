'use server'

import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { boards } from '@/db/schema'
import { createContribution, countContributionsByBoard } from '@/db/contributions'
import { contributionSchema } from '@/domain/validation'
import { MAX_CONTRIBUTION_HALER } from '@/domain/limits'
import { track } from '@/lib/analytics'
import { checkRateLimit } from '@/lib/rateLimit'

const MAX_CONTRIBUTIONS_PER_BOARD = 1000

const isPlausibleHaler = (v: number): boolean =>
  Number.isInteger(v) && v >= 0 && v <= MAX_CONTRIBUTION_HALER

/**
 * Analytics-only counterpart of signAction for the /demo board (which has no
 * DB row). Demo signatures are the landing funnel's key engagement moment;
 * they aggregate under the fixed distinct id 'demo' since visitors are
 * anonymous. Never returns an error — the demo flow must not depend on it.
 */
export const demoSignAction = async (input: {
  amountHaler: number
  tipHaler: number
  hasName: boolean
  hasMessage: boolean
}): Promise<void> => {
  const ip = (await headers()).get('x-forwarded-for') ?? 'unknown'
  if (!(await checkRateLimit(`${ip}:demo`, 'write'))) return
  if (!isPlausibleHaler(input.amountHaler) || !isPlausibleHaler(input.tipHaler)) return
  await track('board_demo_signed', 'demo', {
    amount_haler: input.amountHaler,
    tip_haler: input.tipHaler,
    has_name: input.hasName,
    has_message: input.hasMessage,
  })
}

export const signAction = async (input: {
  token: string
  name?: string
  message?: string
  selectionSnapshot: unknown
  amountHaler: number
  tipHaler: number
}): Promise<{ ok: boolean; error?: string }> => {
  const ip = (await headers()).get('x-forwarded-for') ?? 'unknown'
  if (!(await checkRateLimit(`${ip}:${input.token}`, 'write'))) {
    return { ok: false, error: 'Příliš mnoho pokusů, zkuste to za chvíli.' }
  }

  const parsed = contributionSchema.safeParse({
    name: input.name,
    message: input.message,
    amountHaler: input.amountHaler,
    tipHaler: input.tipHaler,
    selectionSnapshot: input.selectionSnapshot,
  })
  if (!parsed.success) return { ok: false, error: 'Neplatný vstup' }

  const board = await db.query.boards.findFirst({ where: eq(boards.token, input.token) })
  if (!board) return { ok: false, error: 'Board neexistuje' }
  if (board.archivedAt) return { ok: false, error: 'Tato akce už skončila.' }

  const contributionCount = await countContributionsByBoard(input.token)
  if (contributionCount >= MAX_CONTRIBUTIONS_PER_BOARD) {
    return { ok: false, error: 'Tento board má příliš mnoho podpisů.' }
  }

  await createContribution({
    boardId: input.token,
    name: parsed.data.name,
    message: parsed.data.message,
    selectionSnapshot: parsed.data.selectionSnapshot,
    amountHaler: parsed.data.amountHaler,
    tipHaler: parsed.data.tipHaler,
  })
  // The payer is anonymous, but we attribute the signature to the board's
  // host (board.userId) so it lands on the same person as board_created /
  // board_paid — otherwise the conversion funnel breaks across the
  // host↔payer boundary. board_token stays as a property for board-level
  // breakdowns.
  await track('board_signed', board.userId, {
    board_token: input.token,
    amount_haler: parsed.data.amountHaler,
    tip_haler: parsed.data.tipHaler,
    has_message: Boolean(parsed.data.message),
    has_name: Boolean(parsed.data.name),
  })
  return { ok: true }
}
