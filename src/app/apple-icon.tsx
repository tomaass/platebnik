import { ImageResponse } from 'next/og'
import { DEFAULT_THEME, THEME_GRADIENTS } from '@/design/themes'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

const [from, to] = THEME_GRADIENTS[DEFAULT_THEME]

export default function AppleIcon() {
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
          fontSize: 116,
          fontWeight: 800,
          fontFamily: 'sans-serif',
        }}
      >
        P
      </div>
    ),
    size,
  )
}
