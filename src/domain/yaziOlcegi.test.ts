import { describe, expect, it } from 'vitest'
import { YAZI_OLCEKLERI, yaziOlcegiCss } from './yaziOlcegi'

describe('yaziOlcegi', () => {
  it('üç ölçek sunar ve normal %100’dür', () => {
    expect(YAZI_OLCEKLERI.map((o) => o.deger)).toEqual([
      'normal',
      'buyuk',
      'cokBuyuk',
    ])
    expect(yaziOlcegiCss('normal')).toBe('100%')
  })

  it('büyük ve çok büyük kökü orantılı büyütür', () => {
    expect(yaziOlcegiCss('buyuk')).toBe('112.5%')
    expect(yaziOlcegiCss('cokBuyuk')).toBe('125%')
  })

  it('tanımsız/bilinmeyen değer güvenli varsayılana (%100) düşer', () => {
    expect(yaziOlcegiCss(undefined)).toBe('100%')
    // @ts-expect-error — bilinmeyen değer kasıtlı
    expect(yaziOlcegiCss('devasa')).toBe('100%')
  })

  it('her ölçeğin etiketi doludur', () => {
    for (const o of YAZI_OLCEKLERI) {
      expect(o.etiket.trim().length).toBeGreaterThan(0)
    }
  })
})
