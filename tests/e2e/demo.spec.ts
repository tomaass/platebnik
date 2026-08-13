import { test, expect } from '@playwright/test'

// The demo board is fully synthetic (no DB row) — the whole flow must work
// without login and without any server mutation.

test('landing page nabízí proklik na demo', async ({ page }) => {
  await page.goto('/')
  const demoLink = page.getByRole('link', { name: /Vyzkoušet demo/ })
  await expect(demoLink).toBeVisible()
  await expect(demoLink).toHaveAttribute('href', '/demo')
})

test('demo: naťukání položky ukáže QR, podpis projde lokálně', async ({ page }) => {
  await page.goto('/demo')
  await expect(page.getByText('Grilovačka — ukázka')).toBeVisible()
  // Conversion banner back to creating a real board.
  await expect(page.getByRole('link', { name: /Vytvoř si vlastní/ })).toBeVisible()

  await page.getByRole('button', { name: 'Přidat Pivo' }).click()
  await expect(page.getByText('40.00 Kč').first()).toBeVisible()
  await expect(page.getByRole('img', { name: 'QR Platba' })).toBeVisible()
  // The live QR is real — the copy must say the payment goes to the author.
  await expect(page.getByText(/naostro/)).toBeVisible()

  await page.getByPlaceholder(/Jméno/).fill('Pepa')
  await page.getByRole('button', { name: 'Podepsat se' }).click()
  await expect(page.getByText('Díky, podpis odeslán!')).toBeVisible()
})
