import { describe, expect, test } from 'vitest'
import { DEFAULT_THEME, isThemeKey, THEME_KEYS, THEMES } from './themes'

describe('themes', () => {
  test('DEFAULT_THEME je platný klíč', () => {
    expect(THEME_KEYS).toContain(DEFAULT_THEME)
  })

  test('THEMES pokrývá všechny klíče a má labely', () => {
    expect(THEMES.map((t) => t.key)).toEqual([...THEME_KEYS])
    expect(THEMES.every((t) => t.label.length > 0)).toBe(true)
  })

  test('isThemeKey rozliší platné a neplatné', () => {
    expect(isThemeKey('sunset')).toBe(true)
    expect(isThemeKey('green')).toBe(true)
    expect(isThemeKey('rainbow')).toBe(false)
    expect(isThemeKey(undefined)).toBe(false)
    expect(isThemeKey(42)).toBe(false)
  })
})
