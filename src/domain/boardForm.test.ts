import { describe, expect, test } from 'vitest'
import { cleanItems, validateBoardForm } from './boardForm'
import { DEFAULT_THEME } from '@/design/themes'

const base = { title: 'Grilovačka', items: [], theme: DEFAULT_THEME }

describe('cleanItems', () => {
  test('zahodí úplně prázdné řádky', () => {
    expect(
      cleanItems([
        { name: '', priceHaler: 0 },
        { name: 'Pivo', priceHaler: 5000 },
        { name: '   ', priceHaler: 0 },
      ]),
    ).toEqual([{ name: 'Pivo', priceHaler: 5000 }])
  })
  test('řádek s cenou bez názvu nechá projít (chytí ho validace)', () => {
    expect(cleanItems([{ name: '', priceHaler: 5000 }])).toEqual([{ name: '', priceHaler: 5000 }])
  })
})

describe('validateBoardForm', () => {
  test('prázdný název je chyba', () => {
    const { errors, valid } = validateBoardForm({ ...base, title: '  ' })
    expect(errors.title).toBe('Zadej název akce')
    expect(valid).toBe(false)
  })
  test('příliš dlouhý název je chyba', () => {
    const { errors } = validateBoardForm({ ...base, title: 'x'.repeat(81) })
    expect(errors.title).toBe('Název je moc dlouhý (max 80 znaků)')
  })
  test('validní board bez položek je valid', () => {
    const { errors, valid } = validateBoardForm(base)
    expect(errors.title).toBeUndefined()
    expect(errors.items).toEqual([])
    expect(valid).toBe(true)
  })
  test('úplně prázdný řádek nehlásí chybu (bude zahozen)', () => {
    const { errors, valid } = validateBoardForm({ ...base, items: [{ name: '', priceHaler: 0 }] })
    expect(errors.items).toEqual([undefined])
    expect(valid).toBe(true)
  })
  test('cena bez názvu hlásí chybu u názvu', () => {
    const { errors, valid } = validateBoardForm({ ...base, items: [{ name: '', priceHaler: 5000 }] })
    expect(errors.items[0]).toEqual({ name: 'Doplň název položky' })
    expect(valid).toBe(false)
  })
  test('příliš dlouhý název položky', () => {
    const { errors } = validateBoardForm({ ...base, items: [{ name: 'x'.repeat(61), priceHaler: 0 }] })
    expect(errors.items[0]).toEqual({ name: 'Název položky je moc dlouhý (max 60 znaků)' })
  })
  test('příliš vysoká cena', () => {
    const { errors } = validateBoardForm({ ...base, items: [{ name: 'Pivo', priceHaler: 100_000_01 }] })
    expect(errors.items[0]).toEqual({ price: 'Cena je moc vysoká' })
  })
})
