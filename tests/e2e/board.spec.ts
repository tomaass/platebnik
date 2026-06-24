import { test, expect } from '@playwright/test'
import { nanoid } from 'nanoid'
import { db } from '../../src/db/client'
import { users } from '../../src/db/schema'
import { createBoard, deleteBoard } from '../../src/db/boards'
import { czAccountToIban } from '../../src/domain/iban'
import { eq } from 'drizzle-orm'

const userId = `e2e-${nanoid(8)}`
let token = ''

test.beforeAll(async () => {
  await db.insert(users).values({
    id: userId, email: `${userId}@test.local`,
    bankAccountRaw: '19-2000145399/0800',
    bankAccountIban: czAccountToIban('19-2000145399/0800'),
  })
  token = await createBoard({ userId, title: 'E2E Gril', items: [{ name: 'Pivo', priceHaler: 4500 }] })
})

test.afterAll(async () => {
  await deleteBoard(token, userId)
  await db.delete(users).where(eq(users.id, userId))
})

test('host vybere položku, vidí cenu a QR, podepíše se', async ({ page }) => {
  await page.goto(`/b/${token}`)
  await expect(page.getByText('E2E Gril')).toBeVisible()
  await page.getByRole('button', { name: '+' }).first().click()
  await expect(page.getByText('Celkem: 45.00 Kč')).toBeVisible()
  await expect(page.getByLabel('QR Platba')).toBeVisible()
  await page.getByPlaceholder('Jméno').fill('Pepa')
  await page.getByRole('button', { name: 'Podepsat se' }).click()
  await expect(page.getByText('Díky, podpis odeslán!')).toBeVisible()
})
