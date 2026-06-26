import { ImageResponse } from 'next/og'
import { getBoardMeta } from '@/db/boards'
import { DEFAULT_THEME } from '@/design/themes'
import { OG_CONTENT_TYPE, OG_SIZE, ogCard } from '@/lib/og'
import { SITE_NAME } from '@/lib/site'

export const alt = `${SITE_NAME} — zaplať za sebe přes QR`
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

// In Next 15 dynamic route params are async — must be awaited.
export default async function BoardOgImage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const board = await getBoardMeta(token)
  const title = board?.title ?? SITE_NAME
  const theme = board?.theme ?? DEFAULT_THEME

  return new ImageResponse(
    ogCard({
      theme,
      footer: 'Naťukej, co sis dal → QR Platba → hotovo',
      children: (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 38, fontWeight: 600, opacity: 0.92 }}>Pozvánka na</div>
          <div
            style={{
              fontSize: 90,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              marginTop: 8,
              // Clamp long titles so the layout never overflows.
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
            }}
          >
            {title}
          </div>
        </div>
      ),
    }),
    size,
  )
}
