import { asc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import * as R from 'remeda'
import type { ItemInput } from '@/domain/types'
import { generateVariableSymbol } from '@/lib/vs'
import { db } from './client'
import { boards, items } from './schema'

export interface BoardWithItems {
  token: string
  userId: string
  title: string
  variableSymbol: string
  tipPercents: number[]
  items: { id: string; name: string; priceHaler: number; position: number }[]
}

export interface BoardSummary {
  token: string
  title: string
  createdAt: Date
}

const itemRows = (boardId: string, list: ItemInput[]) =>
  list.map((it, index) => ({
    id: nanoid(12), boardId, name: it.name, priceHaler: it.priceHaler, position: index,
  }))

export const createBoard = async (input: {
  userId: string
  title: string
  items: ItemInput[]
}): Promise<string> => {
  const token = nanoid(16)
  await db.insert(boards).values({
    token, userId: input.userId, title: input.title,
    variableSymbol: generateVariableSymbol(),
  })
  if (input.items.length > 0) await db.insert(items).values(itemRows(token, input.items))
  return token
}

export const getBoardByToken = async (token: string): Promise<BoardWithItems | null> => {
  const board = await db.query.boards.findFirst({ where: eq(boards.token, token) })
  if (!board) return null
  const rows = await db.select().from(items)
    .where(eq(items.boardId, token)).orderBy(asc(items.position))
  return {
    token: board.token, userId: board.userId, title: board.title,
    variableSymbol: board.variableSymbol, tipPercents: board.tipPercents,
    items: R.map(rows, (r) => ({
      id: r.id, name: r.name, priceHaler: r.priceHaler, position: r.position,
    })),
  }
}

export const listBoardsByUser = async (userId: string): Promise<BoardSummary[]> => {
  const rows = await db.select({
    token: boards.token, title: boards.title, createdAt: boards.createdAt,
  }).from(boards).where(eq(boards.userId, userId))
  return rows
}

const assertOwner = async (token: string, userId: string): Promise<void> => {
  const board = await db.query.boards.findFirst({ where: eq(boards.token, token) })
  if (!board || board.userId !== userId) throw new Error('Forbidden')
}

export const updateBoard = async (
  token: string,
  userId: string,
  input: { title: string; items: ItemInput[] },
): Promise<void> => {
  await assertOwner(token, userId)
  await db.update(boards)
    .set({ title: input.title, updatedAt: new Date() })
    .where(eq(boards.token, token))
  await db.delete(items).where(eq(items.boardId, token))
  if (input.items.length > 0) await db.insert(items).values(itemRows(token, input.items))
}

export const deleteBoard = async (token: string, userId: string): Promise<void> => {
  await assertOwner(token, userId)
  await db.delete(boards).where(eq(boards.token, token))
}
