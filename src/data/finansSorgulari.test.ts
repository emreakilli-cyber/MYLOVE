import { describe, expect, it } from 'vitest'
import { finansGenelOzetHesapla } from './finansSorgulari'
import type { FinansKaydi } from '../domain/types'

/*
 * Büro finans özeti: "Bekleyen ödeme" ve "yaklaşan ödeme" yalnızca GİDER
 * kalemleridir (büronun ödeyeceği). Tahsil edilmemiş gelir (müvekkilin borcu)
 * bekleyen tahsilattır — ödeme tablosunu şişirmemeli. Asistan (dosyaOzeti) da
 * aynı hesabı yalnızca giderle yapar; iki ekran tutarlı olmalı.
 */

// Yerel 15 Ağustos 2026 — vade penceresi (7 gün) buna göre deterministik.
const BUGUN = new Date(2026, 7, 15)

const t = '2026-01-01T00:00:00.000Z'
function kayit(o: Partial<FinansKaydi>): FinansKaydi {
  return {
    id: Math.random().toString(36).slice(2),
    dosyaId: 'd1',
    yon: 'gider',
    kategori: 'harc',
    baslik: 'Kalem',
    tutar: 0,
    odenenTutar: 0,
    tarih: '2026-08-10',
    odemeDurumu: 'bekliyor',
    olusturmaTarihi: t,
    guncellemeTarihi: t,
    ...o,
  }
}

describe('finansGenelOzetHesapla', () => {
  it('bekleyen ödeme yalnızca gideri sayar, kısmi ödemede kalanı alır', () => {
    const kayitlar: FinansKaydi[] = [
      // Bu ay tahsil edilen gelir.
      kayit({ yon: 'gelir', kategori: 'vekalet-ucreti', tutar: 5000, odenenTutar: 5000, odemeDurumu: 'odendi', tarih: '2026-08-10' }),
      // Bu ay ödenen gider.
      kayit({ yon: 'gider', tutar: 2000, odenenTutar: 2000, odemeDurumu: 'odendi', tarih: '2026-08-12' }),
      // Kısmen ödenmiş gider → kalan 700 bekliyor; vade 3 gün sonra (pencerede).
      kayit({ yon: 'gider', tutar: 1000, odenenTutar: 300, odemeDurumu: 'kismi', tarih: '2026-07-01', vadeTarihi: '2026-08-18' }),
      // Bekleyen gider; vade uzak (pencere dışı).
      kayit({ yon: 'gider', tutar: 500, odenenTutar: 0, odemeDurumu: 'bekliyor', tarih: '2026-07-05', vadeTarihi: '2026-12-01' }),
      // Tahsil EDİLMEMİŞ gelir; vade yakın — ama bu bir ödeme değil, TAHSİLAT.
      kayit({ yon: 'gelir', kategori: 'vekalet-ucreti', tutar: 8000, odenenTutar: 0, odemeDurumu: 'bekliyor', tarih: '2026-08-05', vadeTarihi: '2026-08-16' }),
    ]

    const ozet = finansGenelOzetHesapla(kayitlar, BUGUN)

    expect(ozet.buAyTahsilat).toBe(5000)
    expect(ozet.buAyGider).toBe(2000)
    // 700 (kısmi kalan) + 500 (bekleyen) = 1200; bekleyen GELİR (8000) hariç.
    expect(ozet.toplamBekleyen).toBe(1200)
    // Yalnızca kısmi giderin vadesi pencerede; yakın vadeli gelir sayılmaz.
    expect(ozet.yaklasanOdeme).toBe(1)
  })

  it('tüm gelir bekliyorsa bile bekleyen ödeme sıfırdır', () => {
    const kayitlar: FinansKaydi[] = [
      kayit({ yon: 'gelir', kategori: 'vekalet-ucreti', tutar: 9000, odenenTutar: 0, odemeDurumu: 'bekliyor', tarih: '2026-08-01', vadeTarihi: '2026-08-17' }),
    ]
    const ozet = finansGenelOzetHesapla(kayitlar, BUGUN)
    expect(ozet.toplamBekleyen).toBe(0)
    expect(ozet.yaklasanOdeme).toBe(0)
  })
})
