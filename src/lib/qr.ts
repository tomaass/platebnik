import QRCode from 'qrcode'
import { stripDiacritics } from '@/domain/spayd'

// Brand QR colors — shared by the printed PDF QR and the on-screen SVG QR so they can't drift.
export const QR_COLOR = { dark: '#111111', light: '#ffffff' }

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

// PNG data URL for a QR code, black on white. Works in Node (renders without a
// DOM canvas) and in the browser (where `qrcode` uses a canvas element).
// Rendered larger than displayed so it stays crisp in print and on hi-DPI screens.
export const qrPngDataUrl = (
  text: string,
  width = 720,
  margin = 1,
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'M',
): Promise<string> =>
  QRCode.toDataURL(text, { width, margin, errorCorrectionLevel, color: QR_COLOR })
