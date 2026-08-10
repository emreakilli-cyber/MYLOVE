import { describe, expect, it } from 'vitest'
import { dateToIsoDate } from '../domain/tarih'
import { haftaSinirlari } from './takvimSorgulari'

/*
 * Hafta sınırları. Türkiye'de hafta pazartesi başlar, pazar biter. Haftalık
 * takvim görünümü ve hafta içi öge sorgusu bu aralığa dayanır; yanlış sınır →
 * öge kaçırma veya komşu haftadan öge sızması.
 *
 * Referans hafta: 2026-08-10 (Pzt) … 2026-08-16 (Paz).
 */

describe('haftaSinirlari', () => {
  it('pazartesi girişinde o günü başlangıç, pazarı bitiş verir', () => {
    const { bas, son } = haftaSinirlari('2026-08-10')
    expect(dateToIsoDate(bas)).toBe('2026-08-10')
    expect(dateToIsoDate(son)).toBe('2026-08-16')
  })

  it('hafta ortası (perşembe) aynı pazartesi–pazar aralığına düşer', () => {
    const { bas, son } = haftaSinirlari('2026-08-13')
    expect(dateToIsoDate(bas)).toBe('2026-08-10')
    expect(dateToIsoDate(son)).toBe('2026-08-16')
  })

  it('pazar günü hâlâ o haftaya (bir önceki pazartesiye) aittir', () => {
    const { bas, son } = haftaSinirlari('2026-08-16')
    expect(dateToIsoDate(bas)).toBe('2026-08-10')
    expect(dateToIsoDate(son)).toBe('2026-08-16')
  })

  it('başlangıç her zaman pazartesi, bitiş pazar ve aralık tam 6 gündür', () => {
    for (const gun of ['2026-08-10', '2026-08-13', '2026-08-16', '2026-02-28']) {
      const { bas, son } = haftaSinirlari(gun)
      expect(bas.getDay()).toBe(1) // Pazartesi
      expect(son.getDay()).toBe(0) // Pazar
      const gunFarki = Math.round(
        (son.getTime() - bas.getTime()) / (24 * 60 * 60 * 1000),
      )
      expect(gunFarki).toBe(6)
    }
  })
})
