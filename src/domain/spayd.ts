import * as R from 'remeda'
import type { Haler } from './types'

export const sanitizeSpaydMsg = (input: string): string =>
  input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // odstranh diakritická znaménka
    .replace(/[^A-Za-z0-9 .,_-]/g, '')
    .slice(0, 60)

export const formatAmount = (amountHaler: Haler): string =>
  (amountHaler / 100).toFixed(2)

export interface SpaydInput {
  iban: string
  amountHaler: Haler
  variableSymbol: string
  message: string
}

export const buildSpayd = (input: SpaydInput): string => {
  const fields: Array<[string, string]> = [
    ['ACC', input.iban],
    ['AM', formatAmount(input.amountHaler)],
    ['CC', 'CZK'],
    ['X-VS', input.variableSymbol],
    ['MSG', sanitizeSpaydMsg(input.message)],
  ]
  const body = R.pipe(
    fields,
    R.filter(([, value]) => value.length > 0),
    R.map(([key, value]) => `${key}:${value}`),
    R.join('*'),
  )
  return `SPD*1.0*${body}`
}
