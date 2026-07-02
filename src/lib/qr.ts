import QRCode from 'qrcode'
import { stripDiacritics } from '@/domain/spayd'

const QR_COLOR = { dark: '#111111', light: '#ffffff' }

// Slug from a board title: diacritics dropped, lowercased, non-alphanumerics
// collapsed to single dashes, trimmed. Empty string when nothing remains.
export const boardSlug = (title: string): string =>
  stripDiacritics(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

// Branded download filename, e.g. "platebnik-patek-u-toma.pdf".
export const boardFileName = (title: string, ext: string): string => {
  const slug = boardSlug(title)
  return slug ? `platebnik-${slug}.${ext}` : `platebnik-qr.${ext}`
}

// PNG data URL for a QR code, black on white. Works in Node and the browser
// (the `qrcode` package renders PNGs without a DOM canvas). Rendered larger
// than displayed so it stays crisp on hi-DPI screens and in print.
export const qrPngDataUrl = (text: string, width = 720): Promise<string> =>
  QRCode.toDataURL(text, { width, margin: 1, color: QR_COLOR })
