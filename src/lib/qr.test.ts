import { describe, expect, test } from 'vitest'
import { boardSlug, boardFileName, qrPngDataUrl } from './qr'

describe('boardSlug', () => {
  test('slugifies a title', () => {
    expect(boardSlug('Pátek u Toma')).toBe('patek-u-toma')
  })
  test('strips diacritics and special characters', () => {
    expect(boardSlug('Žluťoučký kůň!!')).toBe('zlutoucky-kun')
  })
  test('empty string when nothing sluggable remains', () => {
    expect(boardSlug('   ')).toBe('')
  })
})

describe('boardFileName', () => {
  test('builds a name with the given extension', () => {
    expect(boardFileName('Pátek u Toma', 'pdf')).toBe('platebnik-patek-u-toma.pdf')
    expect(boardFileName('Pátek u Toma', 'png')).toBe('platebnik-patek-u-toma.png')
  })
  test('falls back for an unsluggable title', () => {
    expect(boardFileName('   ', 'pdf')).toBe('platebnik-qr.pdf')
  })
})

describe('qrPngDataUrl', () => {
  test('returns a PNG data URL', async () => {
    const url = await qrPngDataUrl('https://platebnik.cz/b/abc')
    expect(url.startsWith('data:image/png')).toBe(true)
  })
})
