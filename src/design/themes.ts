export const THEME_KEYS = ['sunset', 'green'] as const

export type ThemeKey = (typeof THEME_KEYS)[number]

export const DEFAULT_THEME: ThemeKey = 'sunset'

export const THEMES: { key: ThemeKey; label: string }[] = [
  { key: 'sunset', label: 'Sunset' },
  { key: 'green', label: 'Zelená' },
]

export const isThemeKey = (v: unknown): v is ThemeKey =>
  typeof v === 'string' && (THEME_KEYS as readonly string[]).includes(v)
