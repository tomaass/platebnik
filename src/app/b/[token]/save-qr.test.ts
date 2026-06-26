import { describe, expect, test } from 'vitest'
import { qrCaption, qrFileName } from './save-qr'

describe('qrCaption', () => {
  test('skládá název a částku', () => {
    expect(qrCaption({ title: 'Pátek u Toma', amountFormatted: '350.00' }))
      .toBe('Pátek u Toma • 350.00 Kč')
  })
})

describe('qrFileName', () => {
  test('slugifikuje název', () => {
    expect(qrFileName('Pátek u Toma')).toBe('platebnik-patek-u-toma.png')
  })
  test('odstraní diakritiku a speciální znaky', () => {
    expect(qrFileName('Žluťoučký kůň!!')).toBe('platebnik-zlutoucky-kun.png')
  })
  test('fallback pro prázdný/neslugovatelný název', () => {
    expect(qrFileName('   ')).toBe('platebnik-qr.png')
  })
})
