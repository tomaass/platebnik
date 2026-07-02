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
  })
})
