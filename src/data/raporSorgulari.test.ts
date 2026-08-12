import { describe, expect, it } from 'vitest'
import { raporGunu } from './raporSorgulari'
import { dateToIsoDate } from '../domain/tarih'

/*
 * Rapor aralık kovalaması, olay/görev zaman damgalarını YEREL güne indirmeli
 * ki takvimle aynı günü göstersin. Saf tarihler (finans.tarih) `new Date()`
 * ayrıştırmasına sokulmamalı — "2026-08-15" UTC gece yarısı olarak yorumlanıp
 * negatif ofsette bir gün geriye kayardı.
 */

describe('raporGunu — tarih/zaman damgasını yerel güne indirger', () => {
  it('saf "YYYY-MM-DD" tarihi olduğu gibi döndürür (Date ayrıştırmasına sokmaz)', () => {
    // Her saat diliminde geçerli: "T" yoksa doğrudan dilimlenir, kaymaz.
    expect(raporGunu('2026-08-15')).toBe('2026-08-15')
    expect(raporGunu('2026-01-01')).toBe('2026-01-01')
    expect(raporGunu('2026-12-31')).toBe('2026-12-31')
  })

  it('daha uzun bir saf tarihi (beklenmedik son ek) ilk 10 karaktere indirger', () => {
    expect(raporGunu('2026-08-15 ekstra')).toBe('2026-08-15')
  })

  it('UTC zaman damgasını takvimle AYNI yerel güne çevirir', () => {
    // Sözleşme: rapor kovası, takvimin kullandığı yerel-gün ile birebir olmalı.
    for (const iso of [
      '2026-08-15T09:00:00Z',
      '2026-08-31T22:00:00.000Z', // UTC+3'te ertesi gün — kritik sınır
      '2026-09-01T00:30:00Z',
    ]) {
      expect(raporGunu(iso)).toBe(dateToIsoDate(new Date(iso)))
    }
  })
})
