import { czAccountToIban, isCzAccountChecksumValid } from '@/domain/iban'
import { DEFAULT_THEME } from '@/design/themes'

// Where the demo QR points when DEMO_ACCOUNT is unset or invalid: a mod-11-valid
// (so banking apps accept the scan) but nonexistent account, so no payment can
// land anywhere. The UI shows sandbox copy in this case — see resolveDemoQr.
export const FALLBACK_DEMO_ACCOUNT = '7777779/0710'
export const FALLBACK_DEMO_IBAN = czAccountToIban(FALLBACK_DEMO_ACCOUNT)!

export interface DemoQr {
  iban: string
  // true → the QR pays the author's real account and the UI may say so;
  // false → placeholder account, the UI must present the QR as a sandbox.
  live: boolean
}

/**
 * IBAN for the demo board's QR. In production DEMO_ACCOUNT holds the author's
 * real account ("buy me a beer"). A missing value falls back quietly (expected
 * in dev/preview); a configured-but-invalid value falls back loudly, because
 * that means production is silently shipping a dead QR.
 */
export const resolveDemoQr = (rawAccount: string | undefined): DemoQr => {
  const raw = rawAccount?.trim() ?? ''
  if (raw === '') return { iban: FALLBACK_DEMO_IBAN, live: false }
  const iban = czAccountToIban(raw)
  if (iban === null || !isCzAccountChecksumValid(raw)) {
    console.warn('[demo] DEMO_ACCOUNT is set but is not a valid Czech account — using the placeholder')
    return { iban: FALLBACK_DEMO_IBAN, live: false }
  }
  return { iban, live: true }
}

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
  // Fixed VS tagging demo/beer payments on the author's bank statement.
  // Deliberately static — do not make this dynamic, the page is prerendered.
  variableSymbol: '20260813',
  theme: DEFAULT_THEME,
} as const
