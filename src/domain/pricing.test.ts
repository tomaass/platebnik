import { describe, expect, test } from 'vitest'
import { itemsSubtotal, selectionTotal, tipFromPercent } from './pricing'
import type { SelectionEntry } from './types'

const entries: SelectionEntry[] = [
  { itemId: 'a', name: 'Pivo', priceHaler: 4500, quantity: 2 },
  { itemId: 'b', name: 'Panák', priceHaler: 6000, quantity: 1 },
]

describe('itemsSubtotal', () => {
  test('sečte cenu * množství', () => {
    expect(itemsSubtotal(entries)).toBe(15000)
  })
  test('prázdný výběr = 0', () => {
    expect(itemsSubtotal([])).toBe(0)
  })
})

describe('tipFromPercent', () => {
  test('10 % z 15000 = 1500', () => {
    expect(tipFromPercent(15000, 10)).toBe(1500)
  })
  test('0 % = 0', () => {
    expect(tipFromPercent(15000, 0)).toBe(0)
  })
  test('zaokrouhlí na celé haléře', () => {
    expect(tipFromPercent(333, 5)).toBe(17) // 16.65 -> 17
  })
})

describe('selectionTotal', () => {
  test('subtotal + dýško', () => {
    expect(selectionTotal({ entries, tipHaler: 1500 })).toBe(16500)
  })
  test('board bez položek, jen dýško', () => {
    expect(selectionTotal({ entries: [], tipHaler: 5000 })).toBe(5000)
  })
})
