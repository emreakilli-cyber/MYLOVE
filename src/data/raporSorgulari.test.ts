import { describe, expect, it } from 'vitest'
import { raporCsv, type RaporVerisi } from './raporSorgulari'

/*
 * CSV dışa aktarım Türkçe Excel hedefli (`;` ayraç + BOM). Regresyon: tutarlar
 * `toFixed(2)` ile NOKTA ondalıkla yazılıyordu ("184500.50"); Türkçe Excel bunu
 * yanlış (metin ya da 18450050) okur. Ondalık ayracı virgül olmalı.
 */

function veri(kismi: Partial<RaporVerisi>): RaporVerisi {
  return {
    aylikTahsilat: [],
    aylikGider: [],
    donemDurusma: 0,
    donemGorusme: 0,
    donemTamamlananGorev: 0,
    giderDagilimi: [],
    sureAciliyet: { kritik: 0, yakin: 0, normal: 0 },
    dosyaBakiye: [],
    toplamTahsilat: 0,
    toplamGider: 0,
    ...kismi,
  }
}

describe('raporCsv — Türkçe ondalık', () => {
  it('aylık tutarları virgül ondalıkla yazar (184500,50), nokta değil', () => {
    const csv = raporCsv(
      veri({
        aylikTahsilat: [{ etiket: 'Ağu', onEk: '2026-08', deger: 18_450_050 }],
        aylikGider: [{ etiket: 'Ağu', onEk: '2026-08', deger: 61_500 }],
      }),
    )
    expect(csv).toContain('2026-08;184500,50;615,00')
    expect(csv).not.toContain('184500.50')
  })

  it('kategori giderlerini de virgül ondalıkla yazar', () => {
    const csv = raporCsv(
      veri({
        giderDagilimi: [
          { kategori: 'harc', etiket: 'Harç', tutar: 1_168_500 },
        ],
      }),
    )
    expect(csv).toContain('Harç;11685,00')
    expect(csv).not.toContain('11685.00')
  })

  it('Türkçe Excel için ; ayracı ve BOM ile başlar', () => {
    const csv = raporCsv(veri({}))
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('Ay;Tahsilat (TL);Gider (TL)')
  })
})
