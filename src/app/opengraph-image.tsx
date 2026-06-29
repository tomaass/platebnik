import { ImageResponse } from 'next/og'
import { DEFAULT_THEME } from '@/design/themes'
import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from '@/lib/og'
import { SITE_TAGLINE, SITE_TITLE } from '@/lib/site'

export const alt = SITE_TITLE
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default function OgImage() {
  return new ImageResponse(
    ogCard({
      theme: DEFAULT_THEME,
      footer: 'platebnik.cz · zdarma, bez instalace',
      children: (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em' }}>
            {SITE_TAGLINE}
          </div>
          <div style={{ fontSize: 38, marginTop: 28, opacity: 0.92 }}>
            Každý zaplatí přímo tobě přes QR Platbu.
          </div>
        </div>
      ),
    }),
    size,
  )
}
