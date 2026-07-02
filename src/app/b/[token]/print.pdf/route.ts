import { getBoardMeta } from '@/db/boards'
import { renderPosterPdf } from '@/pdf/poster'
import { qrPngDataUrl, boardFileName } from '@/lib/qr'
import { track } from '@/lib/analytics'
import { SITE_URL, SITE_HOST } from '@/lib/site'

// @react-pdf/renderer needs Node APIs (fs, fontkit) — force the Node runtime.
export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params
  const board = await getBoardMeta(token)
  if (!board) return new Response('Not found', { status: 404 })

  // Time the whole PDF production (QR encode + render, incl. Twemoji CDN
  // fetches) so `render_ms` gives an early signal if this route gets slow.
  const startedAt = Date.now()
  const boardUrl = `${SITE_URL}/b/${token}`
  const qrDataUrl = await qrPngDataUrl(boardUrl, 1000, 4, 'H')

  const pdf = await renderPosterPdf({
    title: board.title,
    theme: board.theme,
    qrDataUrl,
    shortUrl: `${SITE_HOST}/b/${token}`,
  })
  const renderMs = Date.now() - startedAt

  // Attribute to the board's host (board.userId) so it lands on the same
  // PostHog person as board_created / board_paid — otherwise this event drops
  // out of the host funnel. board_token stays as a property for breakdowns,
  // render_ms for latency monitoring.
  await track('board_print_pdf', board.userId, { board_token: token, render_ms: renderMs })

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${boardFileName(board.title, 'pdf')}"`,
    },
  })
}
