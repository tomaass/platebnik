import { describe, expect, test } from 'vitest'
import { qrCaption, qrFileName, renderQrSvg, canUseCanvas } from './save-qr'

describe('qrCaption', () => {
  test('skládá název a částku', () => {
    expect(qrCaption({ title: 'Pátek u Toma', amountFormatted: '350.00' }))
      .toBe('Pátek u Toma • 350.00 Kč')
  })
  test('ořízne dlouhý název elipsou (ať nepřeteče kartu)', () => {
    const caption = qrCaption({ title: 'Oslava narozenin Tomáše a Barbory u nás doma', amountFormatted: '1234.00' })
    expect(caption).toBe('Oslava narozenin Tomáše a B… • 1234.00 Kč')
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

describe('renderQrSvg', () => {
  test('vrací inline SVG (sizing řeší QrSvg)', async () => {
    const svg = await renderQrSvg('SPD*1.0*ACC:CZ0000')
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('viewBox')
  })
})

describe('canUseCanvas', () => {
  test('je false bez DOM (node prostředí)', () => {
    expect(canUseCanvas()).toBe(false)
  })
})
