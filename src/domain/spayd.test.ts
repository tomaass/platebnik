import { describe, expect, test } from 'vitest'
import { buildSpayd, formatAmount, sanitizeSpaydMsg } from './spayd'

describe('sanitizeSpaydMsg', () => {
  test('odstraní diakritiku', () => {
    expect(sanitizeSpaydMsg('Příliš žluťoučký')).toBe('Prilis zlutoucky')
  })
  test('zahodí nepovolené znaky', () => {
    expect(sanitizeSpaydMsg('Pepa*pivo:2')).toBe('Pepapivo2')
  })
  test('ořízne na 60 znaků', () => {
    expect(sanitizeSpaydMsg('a'.repeat(80))).toHaveLength(60)
  })
})

describe('formatAmount', () => {
  test('haléře na dvě desetinná místa', () => {
    expect(formatAmount(48000)).toBe('480.00')
    expect(formatAmount(16650)).toBe('166.50')
    expect(formatAmount(5)).toBe('0.05')
  })
})

describe('buildSpayd', () => {
  test('sestaví validní SPAYD string', () => {
    const out = buildSpayd({
      iban: 'CZ6508000000192000145399',
      amountHaler: 48000,
      variableSymbol: '204815',
      message: 'Pepa pivo 2',
    })
    expect(out).toBe(
      'SPD*1.0*ACC:CZ6508000000192000145399*AM:480.00*CC:CZK*X-VS:204815*MSG:Pepa pivo 2',
    )
  })
  test('vynechá prázdný MSG i VS', () => {
    const out = buildSpayd({
      iban: 'CZ6508000000192000145399', amountHaler: 5000, variableSymbol: '', message: '',
    })
    expect(out).toBe('SPD*1.0*ACC:CZ6508000000192000145399*AM:50.00*CC:CZK')
  })
})
