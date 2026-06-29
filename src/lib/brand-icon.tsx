import { ImageResponse } from 'next/og'
import { DEFAULT_THEME, THEME_GRADIENTS } from '@/design/themes'

// Single renderer for every generated brand mark (favicon, Apple icon, PWA
// manifest icons). Keeps the gradient "P" identical everywhere and sourced
// from THEME_GRADIENTS so a theme change updates all icons at once.
const [from, to] = THEME_GRADIENTS[DEFAULT_THEME]

export function renderBrandIcon(size: number, { radius = 0 }: { radius?: number } = {}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${from}, ${to})`,
          color: '#ffffff',
          fontSize: Math.round(size * 0.64),
          fontWeight: 800,
          fontFamily: 'sans-serif',
          borderRadius: radius,
        }}
      >
        P
      </div>
    ),
    { width: size, height: size },
  )
}
