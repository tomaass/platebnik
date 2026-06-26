import QRCode from 'qrcode'

export interface QrCardInput {
  spayd: string
  title: string
  amountFormatted: string
}

export const qrCaption = (input: { title: string; amountFormatted: string }): string =>
  `${input.title} • ${input.amountFormatted} Kč`

export const qrFileName = (title: string): string => {
  const slug = title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug ? `platebnik-${slug}.png` : 'platebnik-qr.png'
}

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
const BRAND_URL = 'platebnik.cz'
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

// Geometrie karty — umožní v UI vykreslit jen výřez QR (bez brandingu), zatímco
// long-press uloží celý zdrojový obrázek (kartu s brandingem).
export const CARD_GEOMETRY = {
  width: CARD_W,
  height: CARD_H,
  qr: { x: QR_X, y: QR_Y, size: QR_SIZE },
} as const

export interface QrCardOutput {
  dataUrl: string // pro <img> na stránce (data: URL je na iOS spolehlivě long-pressovatelný)
  blob: Blob // pro tlačítko Uložit (Web Share / download)
}

export const renderQrCard = async (input: QrCardInput): Promise<QrCardOutput> => {
  const qrCanvas = await QRCode.toCanvas(input.spayd, {
    width: QR_SIZE,
    margin: 1,
    color: { dark: '#111111', light: '#ffffff' },
  })

  const card = document.createElement('canvas')
  card.width = CARD_W
  card.height = CARD_H
  const ctx = card.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context není dostupný.')

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

  const blob = await new Promise<Blob>((resolve, reject) =>
    card.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Nepodařilo se vytvořit PNG.'))),
      'image/png',
    ),
  )

  return { dataUrl: card.toDataURL('image/png'), blob }
}

const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  // Odložit revoke o tick — synchronní revoke umí v některých prohlížečích (Firefox desktop) stažení zrušit.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

// Sdílí předem připravený blob. Volá se přímo z click handleru (bez await před share()),
// aby na iOS Safari zůstala zachovaná user-activation a otevřel se share sheet.
// Pozn.: Web Share API je dostupné jen v secure contextu (HTTPS / localhost) — na plain HTTP
// je navigator.share undefined a kód spadne na download fallback.
export const shareOrDownload = async (blob: Blob, fileName: string): Promise<void> => {
  const file = new File([blob], fileName, { type: 'image/png' })

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Platebník — QR platba' })
      return
    } catch (err) {
      // Uživatel zavřel share sheet → nedělat nic. Jiná chyba → fallback na download.
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
  }

  downloadBlob(blob, fileName)
}
