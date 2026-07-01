'use server'

import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { boards } from '@/db/schema'
import { createContribution, countContributionsByBoard } from '@/db/contributions'
import { contributionSchema } from '@/domain/validation'
import { track } from '@/lib/analytics'
import { checkRateLimit } from '@/lib/rateLimit'

const MAX_CONTRIBUTIONS_PER_BOARD = 1000

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
  // Anonymous payer — no identity, so the board token is the distinct id.
  // Board-level funnels aggregate on the board_token property.
  await track('board_signed', input.token, {
    board_token: input.token,
    amount_haler: parsed.data.amountHaler,
    tip_haler: parsed.data.tipHaler,
    has_message: Boolean(parsed.data.message),
    has_name: Boolean(parsed.data.name),
  })
  return { ok: true }
}
