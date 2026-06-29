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

// Brand gradient stops [from, to] per theme — mirrors --grad in globals.css.
// Used where CSS variables can't reach (next/og OG images, generated icons).
// Record keyed by ThemeKey → the compiler forces a gradient for every theme.
export const THEME_GRADIENTS: Record<ThemeKey, readonly [string, string]> = {
  sunset: ['#ff9a3d', '#f0407e'],
  green: ['#34c759', '#0e9e6e'],
}

// Page background per theme — mirrors --bg in globals.css. Used where CSS
// variables can't reach (PWA manifest background_color).
export const THEME_BACKGROUNDS: Record<ThemeKey, string> = {
  sunset: '#fff9f7',
  green: '#f6fbf3',
}

export const isThemeKey = (v: unknown): v is ThemeKey =>
  typeof v === 'string' && (THEME_KEYS as readonly string[]).includes(v)
