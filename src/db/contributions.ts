import { desc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from './client'
import { boards, contributions } from './schema'

export interface ContributionRow {
  id: string
  name: string | null
  message: string | null
  amountHaler: number
  tipHaler: number
  paid: boolean
  createdAt: Date
}

export const createContribution = async (input: {
  boardId: string
  name?: string
  message?: string
  selectionSnapshot: unknown
  amountHaler: number
  tipHaler: number
}): Promise<string> => {
  const id = nanoid(12)
  await db.insert(contributions).values({
    id, boardId: input.boardId, name: input.name ?? null, message: input.message ?? null,
    selectionSnapshot: input.selectionSnapshot, amountHaler: input.amountHaler,
    tipHaler: input.tipHaler,
  })
  return id
}

const assertBoardOwner = async (boardId: string, userId: string): Promise<void> => {
  const board = await db.query.boards.findFirst({ where: eq(boards.token, boardId) })
  if (!board || board.userId !== userId) throw new Error('Forbidden')
}

export const listContributionsByBoard = async (
  token: string,
  userId: string,
): Promise<ContributionRow[]> => {
  await assertBoardOwner(token, userId)
  return db.select({
    id: contributions.id, name: contributions.name, message: contributions.message,
    amountHaler: contributions.amountHaler, tipHaler: contributions.tipHaler,
    paid: contributions.paid, createdAt: contributions.createdAt,
  }).from(contributions).where(eq(contributions.boardId, token))
    .orderBy(desc(contributions.createdAt))
}

export const setPaid = async (
  id: string,
  userId: string,
  paid: boolean,
): Promise<void> => {
  const row = await db.query.contributions.findFirst({ where: eq(contributions.id, id) })
  if (!row) throw new Error('Not found')
  await assertBoardOwner(row.boardId, userId)
  await db.update(contributions).set({ paid }).where(eq(contributions.id, id))
}
