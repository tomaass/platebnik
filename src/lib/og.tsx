import type { ReactNode } from 'react'
import { THEME_GRADIENTS, type ThemeKey } from '@/design/themes'
import { SITE_NAME } from './site'

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

// Shared 1200×630 OG card chrome — theme gradient background, brand header and
// footer line. Returns a Satori-compatible tree for next/og ImageResponse so
// both OG routes stay visually in sync.
export function ogCard({
  theme,
  footer,
  children,
}: {
  theme: ThemeKey
  footer: string
  children: ReactNode
}) {
  const [from, to] = THEME_GRADIENTS[theme]
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '80px',
        background: `linear-gradient(135deg, ${from}, ${to})`,
        color: '#ffffff',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', fontSize: 44, fontWeight: 800 }}>
        <span style={{ fontSize: 56, marginRight: 16 }}>🍺</span>
        {SITE_NAME}
      </div>
      {children}
      <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, opacity: 0.95 }}>{footer}</div>
    </div>
  )
}
