import { cache } from 'react'
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import * as R from 'remeda'
import type { ItemInput } from '@/domain/types'
import { DEFAULT_THEME, isThemeKey, type ThemeKey } from '@/design/themes'
import { generateVariableSymbol } from '@/lib/vs'
import { db } from './client'
import { boards, items } from './schema'

// Lightweight title+theme lookup for metadata and OG images — avoids the full
// items fetch those paths would otherwise discard. cache() dedupes the call
// within a single request (e.g. generateMetadata running alongside the page).
export const getBoardMeta = cache(
  async (token: string): Promise<{ title: string; theme: ThemeKey } | null> => {
    const board = await db.query.boards.findFirst({
      where: eq(boards.token, token),
      columns: { title: true, theme: true },
    })
    if (!board) return null
    return { title: board.title, theme: isThemeKey(board.theme) ? board.theme : DEFAULT_THEME }
  },
)

export interface BoardWithItems {
  token: string
  userId: string
  title: string
  variableSymbol: string
  tipPercents: number[]
  theme: ThemeKey
  archivedAt: Date | null
  items: { id: string; name: string; priceHaler: number; position: number }[]
}

export interface BoardSummary {
  token: string
  title: string
  createdAt: Date
  archivedAt: Date | null
}

const itemRows = (boardId: string, list: ItemInput[]) =>
  list.map((it, index) => ({
    id: nanoid(12), boardId, name: it.name, priceHaler: it.priceHaler, position: index,
  }))

export const createBoard = async (input: {
  userId: string
  title: string
  items: ItemInput[]
  theme?: ThemeKey
}): Promise<string> => {
  const token = nanoid(16)
  await db.insert(boards).values({
    token, userId: input.userId, title: input.title,
    theme: input.theme ?? DEFAULT_THEME,
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
    theme: isThemeKey(board.theme) ? board.theme : DEFAULT_THEME,
    archivedAt: board.archivedAt,
    items: R.map(rows, (r) => ({
      id: r.id, name: r.name, priceHaler: r.priceHaler, position: r.position,
    })),
  }
}

export const listBoardsByUser = async (userId: string): Promise<BoardSummary[]> => {
  const rows = await db.select({
    token: boards.token, title: boards.title,
    createdAt: boards.createdAt, archivedAt: boards.archivedAt,
  }).from(boards).where(eq(boards.userId, userId)).orderBy(desc(boards.createdAt))
  return rows
}

const assertOwner = async (token: string, userId: string): Promise<void> => {
  const board = await db.query.boards.findFirst({ where: eq(boards.token, token) })
  if (!board || board.userId !== userId) throw new Error('Forbidden')
}

export const updateBoard = async (
  token: string,
  userId: string,
  input: { title: string; items: ItemInput[]; theme?: ThemeKey },
): Promise<void> => {
  await assertOwner(token, userId)
  await db.update(boards)
    // Only overwrite theme when explicitly provided — an omitted theme must not silently reset it.
    .set({ title: input.title, ...(input.theme ? { theme: input.theme } : {}), updatedAt: new Date() })
    .where(eq(boards.token, token))
  await db.delete(items).where(eq(items.boardId, token))
  if (input.items.length > 0) await db.insert(items).values(itemRows(token, input.items))
}

export const deleteBoard = async (token: string, userId: string): Promise<void> => {
  await assertOwner(token, userId)
  await db.delete(boards).where(eq(boards.token, token))
}

export const archiveBoard = async (token: string, userId: string): Promise<void> => {
  await assertOwner(token, userId)
  await db.update(boards).set({ archivedAt: new Date() }).where(eq(boards.token, token))
}

export const unarchiveBoard = async (token: string, userId: string): Promise<void> => {
  await assertOwner(token, userId)
  await db.update(boards).set({ archivedAt: null }).where(eq(boards.token, token))
}

export const getLatestBoardTheme = async (userId: string): Promise<ThemeKey> => {
  const rows = await db.select({ theme: boards.theme }).from(boards)
    .where(and(eq(boards.userId, userId), isNull(boards.archivedAt)))
    .orderBy(desc(boards.createdAt))
    .limit(1)
  const theme = rows[0]?.theme
  return isThemeKey(theme) ? theme : DEFAULT_THEME
}
