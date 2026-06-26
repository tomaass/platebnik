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
const PADDING = 48
const QR_SIZE = 480
const BRAND_H = 44
const CAPTION_H = 40
const GAP = 24
const CARD_W = QR_SIZE + PADDING * 2
const CARD_H = PADDING + BRAND_H + GAP + QR_SIZE + GAP + CAPTION_H + PADDING

export const renderQrCard = async (input: QrCardInput): Promise<Blob> => {
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
  ctx.fillText('Platebník', CARD_W / 2, PADDING + 30)

  const qrY = PADDING + BRAND_H + GAP
  ctx.drawImage(qrCanvas, PADDING, qrY, QR_SIZE, QR_SIZE)

  ctx.fillStyle = '#555555'
  ctx.font = `400 22px ${FONT_STACK}`
  ctx.fillText(qrCaption(input), CARD_W / 2, qrY + QR_SIZE + GAP + 22)

  return new Promise<Blob>((resolve, reject) =>
    card.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Nepodařilo se vytvořit PNG.'))),
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
  URL.revokeObjectURL(url)
}

export const saveQrPng = async (input: QrCardInput): Promise<void> => {
  const blob = await renderQrCard(input)
  const file = new File([blob], qrFileName(input.title), { type: 'image/png' })

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Platebník — QR platba' })
      return
    } catch (err) {
      // Uživatel zavřel share sheet → nedělat nic. Jiná chyba → fallback na download.
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
  }

  downloadBlob(blob, file.name)
}
