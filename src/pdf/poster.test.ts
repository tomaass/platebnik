import { describe, expect, test } from 'vitest'
import { renderPosterPdf } from './poster'

describe('renderPosterPdf', () => {
  test('renders a PDF buffer without throwing on Czech text', async () => {
    const buffer = await renderPosterPdf({
      title: 'Žluťoučký táborák u Bédi',
      theme: 'sunset',
      shortUrl: 'platebnik.cz/b/ABC123',
      // 1x1 transparent PNG stand-in for the QR image
      qrDataUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42m\
NkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    })
    expect(Buffer.isBuffer(buffer)).toBe(true)
    // Every PDF starts with the "%PDF" magic bytes.
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF')
    expect(buffer.length).toBeGreaterThan(1000)
    // The page must be full A4 — this is react-pdf's A4 MediaBox. A collapsed
    // page (e.g. from wrap={false}) would have a shorter height instead.
    expect(buffer.toString('latin1')).toContain('595.280029 841.890015')
  })

  test('clips a very long Czech title to a single page without throwing', async () => {
    const buffer = await renderPosterPdf({
      // 200 Czech chars would overflow to a second page without the title
      // truncation guard (maxLines: 2 + textOverflow: 'ellipsis').
      title: 'Řeřicha '.repeat(25),
      theme: 'green',
      shortUrl: 'platebnik.cz/b/XYZ789',
      qrDataUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42m\
NkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    })
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF')
    expect(buffer.length).toBeGreaterThan(1000)
    // Full A4 page (not collapsed to content height).
    expect(buffer.toString('latin1')).toContain('595.280029 841.890015')
    // Exactly one page — the title guard keeps it single-page, no pagination.
    expect((buffer.toString('latin1').match(/MediaBox/g) || []).length).toBe(1)
  })
})
