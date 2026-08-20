import { describe, expect, it } from 'vitest'
import { dateToIsoDate } from '../domain/tarih'
import { gunAraligiUtcSinirlari, haftaSinirlari } from './takvimSorgulari'

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

/*
 * Yerel gün → UTC aralık sınırı. Olaylar UTC damgası tutar ama takvim yerel güne
 * kovalar. Aralık sınırı naif `${gun}T00:00:00Z` ile hesaplansaydı, UTC+3'te ilk
 * günün tüm-gün olayları (yerel gece yarısı = önceki gün 21:00Z) aralık başından
 * ÖNCEYE düşüp takvimden KAYBOLURDU. Testler Europe/Istanbul'da koşuyor (bkz.
 * vite.config test.env.TZ), bu yüzden sınır hedef saat diliminde doğrulanabilir.
 */
describe('gunAraligiUtcSinirlari', () => {
  it('yerel gün başlangıcını/bitişini doğru UTC anına çevirir (UTC+3)', () => {
    const { basDamga, sonDamga } = gunAraligiUtcSinirlari('2026-08-15', '2026-08-15')
    // İstanbul'da 15 Ağu 00:00 = 14 Ağu 21:00 UTC; 15 Ağu 23:59:59.999 = 15 Ağu 20:59:59.999 UTC.
    expect(basDamga).toBe('2026-08-14T21:00:00.000Z')
    expect(sonDamga).toBe('2026-08-15T20:59:59.999Z')
  })

  it('aralık başı, o günün yerel gece yarısı olayını (önceki gün 21:00Z) DIŞLAMAZ', () => {
    const { basDamga } = gunAraligiUtcSinirlari('2026-08-15', '2026-08-20')
    // Yerel 15 Ağu 00:00 olayı UTC'de 14 Ağu 21:00Z; aralık başı buna eşit ya da
    // önce olmalı ki olay aralığa girsin (naif `...T00:00:00Z` = 15 Ağu 00:00Z
    // olsaydı bu olay dışarıda kalırdı).
    const yerelGeceYarisiOlay = '2026-08-14T21:00:00.000Z'
    expect(basDamga <= yerelGeceYarisiOlay).toBe(true)
  })
})
