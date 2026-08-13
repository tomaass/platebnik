import { describe, expect, test } from 'vitest'
import { czAccountToIban, isCzAccountChecksumValid, isValidCzAccount, parseCzAccount } from './iban'

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

describe('isCzAccountChecksumValid', () => {
  test('přijme účty s platným mod-11 (s předčíslím i bez)', () => {
    expect(isCzAccountChecksumValid('19-2000145399/0800')).toBe(true)
    expect(isCzAccountChecksumValid('80200589/0300')).toBe(true)
  })
  test('odmítne formátově validní číslo s neplatným mod-11', () => {
    // vážený součet 7777777 je 273, 273 % 11 = 9
    expect(isCzAccountChecksumValid('7777777/0710')).toBe(false)
  })
  test('odmítne neplatné předčíslí i při platném čísle', () => {
    expect(isCzAccountChecksumValid('1-2000145399/0800')).toBe(false)
  })
  test('odmítne neparsovatelný vstup', () => {
    expect(isCzAccountChecksumValid('nesmysl')).toBe(false)
  })
})
