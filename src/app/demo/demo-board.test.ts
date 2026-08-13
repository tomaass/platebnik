import { afterEach, describe, expect, it, vi } from 'vitest'
import { isCzAccountChecksumValid } from '@/domain/iban'
import { DEMO_BOARD, FALLBACK_DEMO_ACCOUNT, FALLBACK_DEMO_IBAN, resolveDemoQr } from './demo-board'

afterEach(() => { vi.restoreAllMocks() })

describe('resolveDemoQr', () => {
  it('is live with the configured Czech account converted to IBAN', () => {
    expect(resolveDemoQr('19-2000145399/0800')).toEqual({
      iban: 'CZ6508000000192000145399', live: true,
    })
  })

  it('falls back (not live) when nothing is configured', () => {
    expect(resolveDemoQr(undefined)).toEqual({ iban: FALLBACK_DEMO_IBAN, live: false })
    expect(resolveDemoQr('')).toEqual({ iban: FALLBACK_DEMO_IBAN, live: false })
  })

  it('falls back and warns when the configured account is unparsable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveDemoQr('not-an-account')).toEqual({ iban: FALLBACK_DEMO_IBAN, live: false })
    expect(warn).toHaveBeenCalledOnce()
  })

  it('falls back and warns when the configured account fails the mod-11 checksum', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveDemoQr('7777777/0800')).toEqual({ iban: FALLBACK_DEMO_IBAN, live: false })
    expect(warn).toHaveBeenCalledOnce()
  })

  it('fallback account passes the mod-11 checksum and yields a well-formed IBAN', () => {
    expect(isCzAccountChecksumValid(FALLBACK_DEMO_ACCOUNT)).toBe(true)
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
