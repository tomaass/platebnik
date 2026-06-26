import { describe, expect, test } from 'vitest'
import { fillSvg } from './QrSvg'

describe('fillSvg', () => {
  test('injektuje responzivní velikost do <svg>', () => {
    const out = fillSvg('<svg viewBox="0 0 27 27"><path/></svg>')
    expect(out).toBe('<svg style="width:100%;height:100%;display:block" viewBox="0 0 27 27"><path/></svg>')
  })
  test('funguje i pro <svg> bez mezery za tagem', () => {
    expect(fillSvg('<svg>x</svg>')).toBe('<svg style="width:100%;height:100%;display:block">x</svg>')
  })
})
