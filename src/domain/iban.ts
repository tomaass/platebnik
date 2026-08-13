const ACCOUNT_RE = /^(?:(\d{1,6})-)?(\d{1,10})\/(\d{4})$/

export const parseCzAccount = (
  raw: string,
): { prefix: string; number: string; bankCode: string } | null => {
  const match = ACCOUNT_RE.exec(raw.trim())
  if (!match) return null
  return { prefix: match[1] ?? '', number: match[2], bankCode: match[3] }
}

const mod97 = (digits: string): number =>
  // zpracování po blocích, aby se vešlo do bezpečného integeru
  [...digits].reduce((acc, ch) => (acc * 10 + Number(ch)) % 97, 0)

const lettersToDigits = (s: string): string =>
  [...s].map((ch) => (/[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch)).join('')

export const czAccountToIban = (raw: string): string | null => {
  const parsed = parseCzAccount(raw)
  if (!parsed) return null
  const bban =
    parsed.bankCode + parsed.prefix.padStart(6, '0') + parsed.number.padStart(10, '0')
  const checkSource = lettersToDigits(bban + 'CZ00')
  const check = String(98 - mod97(checkSource)).padStart(2, '0')
  return `CZ${check}${bban}`
}

export const isValidCzAccount = (raw: string): boolean => czAccountToIban(raw) !== null

// ČNB mod-11: váha číslice na pozici i (zprava) je 2^i mod 11; vážený součet
// každé části (předčíslí i číslo zvlášť) musí být dělitelný 11.
const mod11Ok = (digits: string): boolean =>
  [...digits]
    .reverse()
    .reduce((sum, ch, i) => sum + Number(ch) * (2 ** i % 11), 0) % 11 === 0

export const isCzAccountChecksumValid = (raw: string): boolean => {
  const parsed = parseCzAccount(raw)
  if (!parsed) return false
  return (parsed.prefix === '' || mod11Ok(parsed.prefix)) && mod11Ok(parsed.number)
}
