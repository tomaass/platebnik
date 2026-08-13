import { czAccountToIban } from '@/domain/iban'
import { DEFAULT_THEME } from '@/design/themes'

// Where the demo QR points when DEMO_ACCOUNT is unset (dev/preview): a
// checksum-valid but nonexistent account, so the QR renders and scans yet no
// payment can land anywhere.
export const FALLBACK_DEMO_IBAN = czAccountToIban('7777777/0710')!

/**
 * IBAN for the demo board's QR. In production DEMO_ACCOUNT holds the author's
 * real account ("buy me a beer"); anything missing or unparsable falls back to
 * the placeholder so the demo works in every environment.
 */
export const resolveDemoIban = (rawAccount: string | undefined): string =>
  (rawAccount !== undefined ? czAccountToIban(rawAccount) : null) ?? FALLBACK_DEMO_IBAN

// Hardcoded showcase board — no DB row behind it, every visitor gets a fresh one.
export const DEMO_BOARD = {
  token: 'demo',
  title: 'Grilovačka — ukázka',
  items: [
    { id: 'beer', name: 'Pivo', priceHaler: 4000 },
    { id: 'sausage', name: 'Klobása', priceHaler: 6000 },
    { id: 'soda', name: 'Limo', priceHaler: 2500 },
  ],
  tipPercents: [0, 5, 10],
  variableSymbol: '20260813',
  theme: DEFAULT_THEME,
} as const
