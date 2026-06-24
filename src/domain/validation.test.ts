import { describe, expect, test } from 'vitest'
import { accountSchema, boardSchema, signatureSchema } from './validation'

describe('accountSchema', () => {
  test('přijme validní účet', () => {
    expect(accountSchema.safeParse({ account: '19-2000145399/0800' }).success).toBe(true)
  })
  test('odmítne nesmysl', () => {
    expect(accountSchema.safeParse({ account: 'xx' }).success).toBe(false)
  })
})

describe('boardSchema', () => {
  test('přijme board s položkami', () => {
    const r = boardSchema.safeParse({
      title: 'Páteční gril', items: [{ name: 'Pivo', priceHaler: 4500 }],
    })
    expect(r.success).toBe(true)
  })
  test('přijme board bez položek (tip jar)', () => {
    expect(boardSchema.safeParse({ title: 'Dýško za gril', items: [] }).success).toBe(true)
  })
  test('odmítne prázdný název', () => {
    expect(boardSchema.safeParse({ title: '', items: [] }).success).toBe(false)
  })
  test('odmítne zápornou cenu', () => {
    const r = boardSchema.safeParse({ title: 'X', items: [{ name: 'A', priceHaler: -1 }] })
    expect(r.success).toBe(false)
  })
})

describe('signatureSchema', () => {
  test('vše volitelné', () => {
    expect(signatureSchema.safeParse({}).success).toBe(true)
  })
  test('odmítne příliš dlouhý vzkaz', () => {
    expect(signatureSchema.safeParse({ message: 'a'.repeat(500) }).success).toBe(false)
  })
})
