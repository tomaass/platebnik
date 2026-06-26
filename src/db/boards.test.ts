import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { nanoid } from 'nanoid'
import { db } from './client'
import { users } from './schema'
import { eq } from 'drizzle-orm'
import {
  createBoard, deleteBoard, getBoardByToken, getLatestBoardTheme, listBoardsByUser, updateBoard,
} from './boards'

const userId = `test-${nanoid(8)}`
beforeAll(async () => {
  await db.insert(users).values({ id: userId, email: `${userId}@test.local` })
})
afterAll(async () => {
  await db.delete(users).where(eq(users.id, userId))
})

describe('boards repository', () => {
  test('createBoard vrátí token a uloží položky', async () => {
    const token = await createBoard({
      userId, title: 'Gril', items: [{ name: 'Pivo', priceHaler: 4500 }],
    })
    const board = await getBoardByToken(token)
    expect(board?.title).toBe('Gril')
    expect(board?.items).toHaveLength(1)
    expect(board?.variableSymbol).toMatch(/^[1-9]\d{7}$/)
    await deleteBoard(token, userId)
  })

  test('board bez položek (tip jar)', async () => {
    const token = await createBoard({ userId, title: 'Dýško', items: [] })
    const board = await getBoardByToken(token)
    expect(board?.items).toHaveLength(0)
    await deleteBoard(token, userId)
  })

  test('updateBoard přepíše položky', async () => {
    const token = await createBoard({ userId, title: 'A', items: [] })
    await updateBoard(token, userId, {
      title: 'B', items: [{ name: 'Víno', priceHaler: 8000 }],
    })
    const board = await getBoardByToken(token)
    expect(board?.title).toBe('B')
    expect(board?.items[0]?.name).toBe('Víno')
    await deleteBoard(token, userId)
  })

  test('updateBoard cizího uživatele vyhodí chybu', async () => {
    const token = await createBoard({ userId, title: 'A', items: [] })
    await expect(updateBoard(token, 'someone-else', { title: 'X', items: [] }))
      .rejects.toThrow()
    await deleteBoard(token, userId)
  })

  test('getBoardByToken neexistující = null', async () => {
    expect(await getBoardByToken('nope')).toBeNull()
  })

  test('board nese motiv a getLatestBoardTheme vrátí poslední', async () => {
    const a = await createBoard({ userId, title: 'A', items: [], theme: 'green' })
    const boardA = await getBoardByToken(a)
    expect(boardA?.theme).toBe('green')

    expect(await getLatestBoardTheme(userId)).toBe('green')

    await updateBoard(a, userId, { title: 'A2', items: [], theme: 'sunset' })
    expect((await getBoardByToken(a))?.theme).toBe('sunset')

    await deleteBoard(a, userId)
  })

  test('getLatestBoardTheme bez boardů = výchozí', async () => {
    expect(await getLatestBoardTheme('nobody-here')).toBe('sunset')
  })

  test('createBoard bez motivu spadne na výchozí', async () => {
    const t = await createBoard({ userId, title: 'X', items: [] })
    expect((await getBoardByToken(t))?.theme).toBe('sunset')
    await deleteBoard(t, userId)
  })
})
