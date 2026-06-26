import { ImageResponse } from 'next/og'
import { DEFAULT_THEME, THEME_GRADIENTS } from '@/design/themes'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

const [from, to] = THEME_GRADIENTS[DEFAULT_THEME]

export default function Icon() {
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
          fontSize: 22,
          fontWeight: 800,
          fontFamily: 'sans-serif',
          borderRadius: 7,
        }}
      >
        P
      </div>
    ),
    size,
  )
}
