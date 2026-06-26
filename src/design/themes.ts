export const THEME_KEYS = ['sunset', 'green'] as const

export type ThemeKey = (typeof THEME_KEYS)[number]

export const DEFAULT_THEME: ThemeKey = 'sunset'

// Record keyed by ThemeKey → the compiler forces a label for every theme key.
export const THEME_LABELS: Record<ThemeKey, string> = {
  sunset: 'Sunset',
  green: 'Zelená',
}

export const THEMES: { key: ThemeKey; label: string }[] =
  THEME_KEYS.map((key) => ({ key, label: THEME_LABELS[key] }))

export const isThemeKey = (v: unknown): v is ThemeKey =>
  typeof v === 'string' && (THEME_KEYS as readonly string[]).includes(v)
