import { randomInt } from 'node:crypto'

/** 8místný variabilní symbol bez vodicí nuly. */
export const generateVariableSymbol = (): string => {
  const first = randomInt(1, 10) // 1..9
  const rest = randomInt(0, 10_000_000).toString().padStart(7, '0')
  return `${first}${rest}`
}
