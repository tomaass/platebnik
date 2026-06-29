import { describe, expect, test } from 'vitest'
import {
  cleanItems, validateBoardForm, isBoardDirty, saveButton, parsePrice, formatPrice,
} from './boardForm'
import { DEFAULT_THEME, THEME_KEYS } from '@/design/themes'

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
  test('záporná cena je chyba', () => {
    const { errors, valid } = validateBoardForm({ ...base, items: [{ name: 'Pivo', priceHaler: -500 }] })
    expect(errors.items[0]).toEqual({ price: 'Cena nemůže být záporná' })
    expect(valid).toBe(false)
  })
  test('víc než MAX_ITEMS položek je chyba (zrcadlí server)', () => {
    const many = Array.from({ length: 101 }, (_, i) => ({ name: `Pivo ${i}`, priceHaler: 100 }))
    const { errors, valid } = validateBoardForm({ ...base, items: many })
    expect(errors.form).toBe('Maximálně 100 položek')
    expect(valid).toBe(false)
  })
  test('přesně MAX_ITEMS položek je v pořádku', () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ name: `Pivo ${i}`, priceHaler: 100 }))
    const { errors, valid } = validateBoardForm({ ...base, items: many })
    expect(errors.form).toBeUndefined()
    expect(valid).toBe(true)
  })
})

describe('isBoardDirty', () => {
  const snap = { title: 'A', items: [{ name: 'Pivo', priceHaler: 5000 }], theme: DEFAULT_THEME }
  test('beze změn není dirty', () => {
    expect(isBoardDirty(snap, snap)).toBe(false)
  })
  test('změna názvu je dirty', () => {
    expect(isBoardDirty({ ...snap, title: 'B' }, snap)).toBe(true)
  })
  test('přidaný prázdný řádek se nepočítá jako změna', () => {
    expect(
      isBoardDirty({ ...snap, items: [...snap.items, { name: '', priceHaler: 0 }] }, snap),
    ).toBe(false)
  })
  test('změna ceny položky je dirty', () => {
    expect(isBoardDirty({ ...snap, items: [{ name: 'Pivo', priceHaler: 6000 }] }, snap)).toBe(true)
  })
  test('změna tématu je dirty', () => {
    const other = THEME_KEYS.find((k) => k !== DEFAULT_THEME)!
    expect(isBoardDirty({ ...snap, theme: other }, snap)).toBe(true)
  })
})

describe('saveButton', () => {
  test('create validní', () => {
    expect(saveButton({ mode: 'create', dirty: true, valid: true, submitting: false })).toEqual({
      label: 'Vytvořit board', disabled: false, muted: false,
    })
  })
  test('create nevalidní je muted ale klikatelné', () => {
    expect(saveButton({ mode: 'create', dirty: true, valid: false, submitting: false })).toEqual({
      label: 'Vytvořit board', disabled: false, muted: true,
    })
  })
  test('create při odesílání', () => {
    expect(saveButton({ mode: 'create', dirty: true, valid: true, submitting: true })).toEqual({
      label: 'Vytvářím…', disabled: true, muted: false,
    })
  })
  test('edit beze změn je disabled Uloženo', () => {
    expect(saveButton({ mode: 'edit', dirty: false, valid: true, submitting: false })).toEqual({
      label: 'Uloženo ✓', disabled: true, muted: false,
    })
  })
  test('edit se změnami', () => {
    expect(saveButton({ mode: 'edit', dirty: true, valid: true, submitting: false })).toEqual({
      label: 'Uložit změny', disabled: false, muted: false,
    })
  })
  test('edit při ukládání', () => {
    expect(saveButton({ mode: 'edit', dirty: true, valid: true, submitting: true })).toEqual({
      label: 'Ukládám…', disabled: true, muted: false,
    })
  })
})

describe('parsePrice', () => {
  test('prázdný řetězec je 0', () => { expect(parsePrice('')).toBe(0) })
  test('celé číslo', () => { expect(parsePrice('120')).toBe(120_00) })
  test('desetinné s tečkou', () => { expect(parsePrice('12.5')).toBe(12_50) })
  test('desetinné s českou čárkou', () => { expect(parsePrice('12,50')).toBe(12_50) })
  test('ignoruje mezery', () => { expect(parsePrice(' 1 2 , 5 0 ')).toBe(12_50) })
  test('záporná cena se zachová (validace ji chytí)', () => { expect(parsePrice('-5')).toBe(-5_00) })
  test('nečíselný text je null', () => { expect(parsePrice('abc')).toBeNull() })
  test('dvě čárky jsou null', () => { expect(parsePrice('1,2,3')).toBeNull() })
})

describe('formatPrice', () => {
  test('0 je prázdný řetězec', () => { expect(formatPrice(0)).toBe('') })
  test('celé koruny bez desetin', () => { expect(formatPrice(12_00)).toBe('12') })
  test('desetiny s českou čárkou', () => { expect(formatPrice(12_50)).toBe('12,5') })
})
