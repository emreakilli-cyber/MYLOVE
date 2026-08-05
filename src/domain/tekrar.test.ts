import { describe, expect, it } from 'vitest'
import { MAKS_TEKRAR, tekrarGunleri } from './tekrar'

/*
 * Tekrar üreteci saf ve deterministik; bilinen tarihlerle sabitleniyor.
 * 2026-08-12 bir Çarşamba.
 */

describe('tekrarGunleri', () => {
  it('günlük: ardışık günler, ilk gün dahil', () => {
    expect(tekrarGunleri('2026-08-12', 'gunluk', 3)).toEqual([
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
    ])
  })

  it('haftalık: yedişer gün artar', () => {
    expect(tekrarGunleri('2026-08-12', 'haftalik', 3)).toEqual([
      '2026-08-12',
      '2026-08-19',
      '2026-08-26',
    ])
  })

  it('iki haftada bir: on dörder gün', () => {
    expect(tekrarGunleri('2026-08-12', '2haftalik', 2)).toEqual([
      '2026-08-12',
      '2026-08-26',
    ])
  })

  it('aylık: ay sonu taşması kırpılır (31 Ocak → Şubat sonu)', () => {
    expect(tekrarGunleri('2026-01-31', 'aylik', 3)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ])
  })

  it('yıllık: yıl artar', () => {
    expect(tekrarGunleri('2026-08-12', 'yillik', 2)).toEqual([
      '2026-08-12',
      '2027-08-12',
    ])
  })

  it('hafta içi: hafta sonlarını atlar', () => {
    // 2026-08-14 Cuma → sonraki iş günleri 17 (Pzt), 18, 19 Ağustos.
    expect(tekrarGunleri('2026-08-14', 'hafta-ici', 4)).toEqual([
      '2026-08-14',
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
    ])
  })

  it('hafta içi: hafta sonu başlangıcı ilk iş gününe kayar', () => {
    // 2026-08-15 Cumartesi → ilk üretilen gün 17 Ağustos Pazartesi.
    expect(tekrarGunleri('2026-08-15', 'hafta-ici', 1)).toEqual(['2026-08-17'])
  })

  it('adet MAKS_TEKRAR ile sınırlanır, en az 1 üretilir', () => {
    expect(tekrarGunleri('2026-08-12', 'gunluk', 1000)).toHaveLength(MAKS_TEKRAR)
    expect(tekrarGunleri('2026-08-12', 'gunluk', 0)).toEqual(['2026-08-12'])
  })
})
