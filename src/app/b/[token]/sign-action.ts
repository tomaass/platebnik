'use server'

import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { boards } from '@/db/schema'
import { createContribution } from '@/db/contributions'
import { signatureSchema } from '@/domain/validation'
import { checkRateLimit } from '@/lib/rateLimit'

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
  const parsed = signatureSchema.safeParse({ name: input.name, message: input.message })
  if (!parsed.success) return { ok: false, error: 'Neplatný vstup' }

  const board = await db.query.boards.findFirst({ where: eq(boards.token, input.token) })
  if (!board) return { ok: false, error: 'Board neexistuje' }

  await createContribution({
    boardId: input.token, name: parsed.data.name, message: parsed.data.message,
    selectionSnapshot: input.selectionSnapshot,
    amountHaler: input.amountHaler, tipHaler: input.tipHaler,
  })
  return { ok: true }
}
