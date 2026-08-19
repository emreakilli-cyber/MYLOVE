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

  it('dosya bazlı gelir-gider bölümünü ekler', () => {
    const csv = raporCsv(
      veri({
        dosyaBakiye: [
          { dosyaId: 'd1', baslik: 'Yılmaz / Arslan', gelir: 5_500_000, gider: 61_500 },
        ],
      }),
    )
    expect(csv).toContain('Dosya;Gelir (TL);Gider (TL)')
    expect(csv).toContain('Yılmaz / Arslan;55000,00;615,00')
  })

  it('dosya adındaki ; ve tırnağı RFC 4180 ile kaçışlar', () => {
    const csv = raporCsv(
      veri({
        dosyaBakiye: [
          { dosyaId: 'd1', baslik: 'Ali "Reis"; Veli', gelir: 0, gider: 0 },
        ],
      }),
    )
    // `;` ve `"` içeren başlık tırnaklanır, içteki tırnak ikilenir → satır bozulmaz
    expect(csv).toContain('"Ali ""Reis""; Veli";0,00;0,00')
  })

  it('formül enjeksiyonunu (=,+,-,@) baştaki tırnakla etkisizler', () => {
    const csv = raporCsv(
      veri({
        dosyaBakiye: [
          { dosyaId: 'd1', baslik: '=HYPERLINK("http://x")', gelir: 0, gider: 0 },
        ],
      }),
    )
    // baştaki `=` → `'=…`; ayrıca `"` içerdiği için tümü tırnaklanır
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")";0,00;0,00`)
    expect(csv).not.toContain('\n=HYPERLINK')
  })

  it('=, dışındaki formül öneklerini (-, +, @) de etkisizler', () => {
    // `-`, `@` gerçekçi dosya adı başlangıçlarıdır (ör. "- Kapatıldı", "@ref");
    // özel karakter içermediklerinden yalnızca baştaki tırnakla korunur,
    // ayrıca tırnaklanmazlar — satır ham olarak `'…` ile başlamalı.
    const csv = raporCsv(
      veri({
        dosyaBakiye: [
          { dosyaId: 'd1', baslik: '-Acil Dava', gelir: 0, gider: 0 },
          { dosyaId: 'd2', baslik: '@ref-2025', gelir: 0, gider: 0 },
          { dosyaId: 'd3', baslik: '+1 Numara', gelir: 0, gider: 0 },
        ],
      }),
    )
    expect(csv).toContain(`\n'-Acil Dava;0,00;0,00`)
    expect(csv).toContain(`\n'@ref-2025;0,00;0,00`)
    expect(csv).toContain(`\n'+1 Numara;0,00;0,00`)
    // Ham (tırnaklanmamış) formül satırı başlamamalı.
    expect(csv).not.toContain('\n-Acil')
    expect(csv).not.toContain('\n@ref')
  })
})
