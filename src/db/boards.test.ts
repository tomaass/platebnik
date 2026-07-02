import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { nanoid } from 'nanoid'
import { db } from './client'
import { users } from './schema'
import { eq } from 'drizzle-orm'
import {
  archiveBoard, createBoard, deleteBoard, getBoardByToken,
  getLatestBoardTheme, listBoardsByUser, unarchiveBoard, updateBoard,
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

  test('archiveBoard nastaví archivedAt, unarchiveBoard ho vynuluje', async () => {
    const token = await createBoard({ userId, title: 'Gril', items: [] })
    expect((await getBoardByToken(token))?.archivedAt).toBeNull()

    await archiveBoard(token, userId)
    expect((await getBoardByToken(token))?.archivedAt).toBeInstanceOf(Date)

    await unarchiveBoard(token, userId)
    expect((await getBoardByToken(token))?.archivedAt).toBeNull()

    await deleteBoard(token, userId)
  })

  test('archiveBoard cizího uživatele vyhodí chybu', async () => {
    const token = await createBoard({ userId, title: 'A', items: [] })
    await expect(archiveBoard(token, 'someone-else')).rejects.toThrow()
    await deleteBoard(token, userId)
  })

  test('listBoardsByUser nese archivedAt', async () => {
    const active = await createBoard({ userId, title: 'Aktivní', items: [] })
    const gone = await createBoard({ userId, title: 'Pryč', items: [] })
    await archiveBoard(gone, userId)

    const rows = await listBoardsByUser(userId)
    expect(rows.find((b) => b.token === active)?.archivedAt).toBeNull()
    expect(rows.find((b) => b.token === gone)?.archivedAt).toBeInstanceOf(Date)

    await deleteBoard(active, userId)
    await deleteBoard(gone, userId)
  })

  test('getLatestBoardTheme ignoruje archivované akce', async () => {
    const u = `t-${nanoid(6)}`
    await db.insert(users).values({ id: u, email: `${u}@test.local` })
    const token = await createBoard({ userId: u, title: 'Stará', items: [], theme: 'green' })
    await archiveBoard(token, u)
    // The only board is archived → no active board → default theme.
    expect(await getLatestBoardTheme(u)).toBe('sunset')
    await db.delete(users).where(eq(users.id, u)) // cascade also deletes the board
  })
})
