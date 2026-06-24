import { describe, expect, test } from 'vitest'
import { czAccountToIban, isValidCzAccount, parseCzAccount } from './iban'

describe('parseCzAccount', () => {
  test('účet s předčíslím', () => {
    expect(parseCzAccount('19-2000145399/0800')).toEqual({
      prefix: '19', number: '2000145399', bankCode: '0800',
    })
  })
  test('účet bez předčíslí', () => {
    expect(parseCzAccount('2000145399/0800')).toEqual({
      prefix: '', number: '2000145399', bankCode: '0800',
    })
  })
  test('nevalidní formát', () => {
    expect(parseCzAccount('nesmysl')).toBeNull()
    expect(parseCzAccount('123/12')).toBeNull() // krátký kód banky
  })
})

describe('czAccountToIban', () => {
  // Referenční pár ověřený proti generátoru IBAN (KB účet)
  test('účet s předčíslím', () => {
    expect(czAccountToIban('19-2000145399/0800')).toBe('CZ6508000000192000145399')
  })
  test('účet bez předčíslí', () => {
    expect(czAccountToIban('2000145399/0800')).toBe('CZ7908000000002000145399')
  })
  test('nevalidní vstup vrátí null', () => {
    expect(czAccountToIban('nesmysl')).toBeNull()
  })
})

describe('isValidCzAccount', () => {
  test('platný', () => { expect(isValidCzAccount('19-2000145399/0800')).toBe(true) })
  test('neplatný', () => { expect(isValidCzAccount('xx')).toBe(false) })
})
