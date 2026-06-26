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
