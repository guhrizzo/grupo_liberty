import { describe, expect, it } from 'vitest'
import { ehUserAgentMobile } from './dispositivo'

describe('ehUserAgentMobile', () => {
  it('reconhece celulares e tablets', () => {
    expect(ehUserAgentMobile('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148')).toBe(true)
    expect(ehUserAgentMobile('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36')).toBe(true)
    expect(ehUserAgentMobile('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15')).toBe(true)
  })
  it('reconhece computadores', () => {
    expect(ehUserAgentMobile('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36')).toBe(false)
    expect(ehUserAgentMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15')).toBe(false)
  })
  it('sem User-Agent não é mobile', () => {
    expect(ehUserAgentMobile(null)).toBe(false)
    expect(ehUserAgentMobile('')).toBe(false)
  })
})
