import { describe, expect, test } from 'vitest'
import { generateVariableSymbol } from './vs'

describe('generateVariableSymbol', () => {
  test('je 8 číslic', () => {
    expect(generateVariableSymbol()).toMatch(/^[1-9]\d{7}$/)
  })
  test('je rozumně unikátní napříč voláními', () => {
    const set = new Set(R_range(200).map(() => generateVariableSymbol()))
    expect(set.size).toBeGreaterThan(190)
  })
})

function R_range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i)
}
