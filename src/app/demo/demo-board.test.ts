import { describe, expect, it } from 'vitest'
import { DEMO_BOARD, FALLBACK_DEMO_IBAN, resolveDemoIban } from './demo-board'

describe('resolveDemoIban', () => {
  it('converts the configured Czech account to IBAN', () => {
    expect(resolveDemoIban('19-2000145399/0800')).toBe('CZ6508000000192000145399')
  })

  it('falls back to the placeholder IBAN when nothing is configured', () => {
    expect(resolveDemoIban(undefined)).toBe(FALLBACK_DEMO_IBAN)
  })

  it('falls back when the configured account is invalid', () => {
    expect(resolveDemoIban('not-an-account')).toBe(FALLBACK_DEMO_IBAN)
  })

  it('fallback is a syntactically valid Czech IBAN', () => {
    expect(FALLBACK_DEMO_IBAN).toMatch(/^CZ\d{22}$/)
  })
})

describe('DEMO_BOARD', () => {
  it('items have unique ids and positive prices', () => {
    const ids = DEMO_BOARD.items.map((it) => it.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(DEMO_BOARD.items.every((it) => it.priceHaler > 0)).toBe(true)
  })
})
