import { ImageResponse } from 'next/og'
import { DEFAULT_THEME, THEME_GRADIENTS } from '@/design/themes'

// Renders the gradient "P" brand mark at a given size, sourced from
// THEME_GRADIENTS. Backs the PWA manifest icon routes (icon-192/512.png); the
// favicon (icon.tsx) and Apple icon (apple-icon.tsx) keep their own copies.
const [from, to] = THEME_GRADIENTS[DEFAULT_THEME]

export function renderBrandIcon(size: number) {
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
        }}
      >
        P
      </div>
    ),
    { width: size, height: size },
  )
}
