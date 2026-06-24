import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from './client'
import { users } from './schema'
import { createBoard, deleteBoard } from './boards'
import { createContribution, listContributionsByBoard, setPaid } from './contributions'

const userId = `test-${nanoid(8)}`
let token = ''
beforeAll(async () => {
  await db.insert(users).values({ id: userId, email: `${userId}@test.local` })
  token = await createBoard({ userId, title: 'Gril', items: [] })
})
afterAll(async () => {
  await deleteBoard(token, userId)
  await db.delete(users).where(eq(users.id, userId))
})

describe('contributions repository', () => {
  test('vytvoří podpis a vylistuje ho vlastníkovi', async () => {
    await createContribution({
      boardId: token, name: 'Pepa', message: 'díky!',
      selectionSnapshot: [{ name: 'Pivo', quantity: 2 }],
      amountHaler: 9000, tipHaler: 0,
    })
    const rows = await listContributionsByBoard(token, userId)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Pepa')
    expect(rows[0].paid).toBe(false)
  })

  test('listContributionsByBoard pro cizího uživatele vyhodí chybu', async () => {
    await expect(listContributionsByBoard(token, 'other')).rejects.toThrow()
  })

  test('setPaid přepne stav', async () => {
    const rows = await listContributionsByBoard(token, userId)
    await setPaid(rows[0].id, userId, true)
    const after = await listContributionsByBoard(token, userId)
    expect(after.find((r) => r.id === rows[0].id)?.paid).toBe(true)
  })

  test('setPaid od cizího uživatele vyhodí chybu', async () => {
    const rows = await listContributionsByBoard(token, userId)
    await expect(setPaid(rows[0].id, 'other', true)).rejects.toThrow()
  })
})
