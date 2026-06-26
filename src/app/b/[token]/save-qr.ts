import QRCode from 'qrcode'
import { stripDiacritics } from '@/domain/spayd'

export interface QrCardInput {
  spayd: string
  title: string
  amountFormatted: string
}

const MAX_CAPTION_TITLE = 28

export const qrCaption = (input: { title: string; amountFormatted: string }): string => {
  const title =
    input.title.length > MAX_CAPTION_TITLE
      ? `${input.title.slice(0, MAX_CAPTION_TITLE - 1).trimEnd()}…`
      : input.title
  return `${title} • ${input.amountFormatted} Kč`
}

export const qrFileName = (title: string): string => {
  const slug = stripDiacritics(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug ? `platebnik-${slug}.png` : 'platebnik-qr.png'
}

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
const BRAND_URL = 'platebnik.cz'
const QR_COLOR = { dark: '#111111', light: '#ffffff' }

// Plain QR for on-screen display (no branding). A data: URL is reliably long-pressable on iOS
// ("Add to Photos"), unlike inline SVG. Rendered larger than shown so it stays crisp on hi-DPI.
// Uses canvas under the hood (toDataURL).
export const renderQrDataUrl = (spayd: string): Promise<string> =>
  QRCode.toDataURL(spayd, { width: 720, margin: 1, color: QR_COLOR })

// Canvas-free SVG QR for display when canvas/toDataURL is unavailable (some in-app WebViews).
// Not long-pressable, but keeps the payment QR scannable everywhere. Render it via <QrSvg>,
// which handles responsive sizing.
export const renderQrSvg = (spayd: string): Promise<string> =>
  QRCode.toString(spayd, { type: 'svg', margin: 1, color: QR_COLOR })

// One-shot probe: is canvas usable here? Catches both missing getContext and privacy-hardened
// browsers where toDataURL returns a blank string instead of a PNG. Lets callers skip the doomed
// PNG/card path in canvas-less WebViews instead of failing and retrying every render.
export const canUseCanvas = (): boolean => {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    if (!canvas.getContext('2d')) return false
    return canvas.toDataURL('image/png').startsWith('data:image/png')
  } catch {
    return false
  }
}

// Card layout — the canvas draws the QR at QR_X/QR_Y/QR_SIZE. When adding design later
// (e.g. a logo), add a new constant and fold it into QR_Y and CARD_H — never hardcode positions.
const PADDING = 48
const QR_SIZE = 480
const BRAND_H = 40
const URL_H = 30
const CAPTION_H = 40
const GAP = 20
const QR_X = PADDING
const QR_Y = PADDING + BRAND_H + URL_H + GAP
const CARD_W = QR_SIZE + PADDING * 2
const CARD_H = PADDING + BRAND_H + URL_H + GAP + QR_SIZE + GAP + CAPTION_H + PADDING

// Branded card (Platebník + platebnik.cz + QR + caption) for the "Uložit QR" button.
export const renderQrCard = async (input: QrCardInput): Promise<Blob> => {
  const qrCanvas = await QRCode.toCanvas(input.spayd, { width: QR_SIZE, margin: 1, color: QR_COLOR })

  const card = document.createElement('canvas')
  card.width = CARD_W
  card.height = CARD_H
  const ctx = card.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context is unavailable.')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#111111'
  ctx.font = `600 28px ${FONT_STACK}`
  ctx.fillText('Platebník', CARD_W / 2, PADDING + 28)

  ctx.fillStyle = '#888888'
  ctx.font = `400 20px ${FONT_STACK}`
  ctx.fillText(BRAND_URL, CARD_W / 2, PADDING + BRAND_H + 20)

  ctx.drawImage(qrCanvas, QR_X, QR_Y, QR_SIZE, QR_SIZE)

  ctx.fillStyle = '#555555'
  ctx.font = `400 22px ${FONT_STACK}`
  ctx.fillText(qrCaption(input), CARD_W / 2, QR_Y + QR_SIZE + GAP + 22)

  return new Promise<Blob>((resolve, reject) =>
    card.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to create PNG.'))),
      'image/png',
    ),
  )
}

const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  // Defer revoke by a tick — a synchronous revoke can cancel the download in some browsers (Firefox desktop).
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

// A user-cancelled share rejects with an AbortError (older WebKit threw a plain Error, not a DOMException).
const isShareCancel = (err: unknown): boolean => err instanceof Error && err.name === 'AbortError'

// Shares a pre-rendered blob. Called directly from the click handler (no await before share())
// so iOS Safari keeps the user activation and opens the share sheet.
// Note: the Web Share API is only available in a secure context (HTTPS / localhost) — on plain HTTP
// navigator.share is undefined and the code falls back to download.
export const shareOrDownload = async (blob: Blob, fileName: string): Promise<void> => {
  const file = new File([blob], fileName, { type: 'image/png' })

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Platebník — QR platba' })
      return
    } catch (err) {
      // User dismissed the share sheet → do nothing. Any other error → fall back to download.
      if (isShareCancel(err)) return
    }
  }

  downloadBlob(blob, fileName)
}
