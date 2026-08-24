import { describe, expect, it } from 'vitest'
import { finansOzeti } from './dosyaSorgulari'
import type { FinansKaydi } from '../domain/types'

/*
 * `finansOzeti` dosya detayını ve müvekkil profilini besleyen gelir–gider
 * özetidir. Para gösterdiği için hesap kuralları kilitlenmeli:
 *   - gelir/gider = TAHSİL/ÖDENEN tutar (odenenTutar), faturalanan (tutar) değil
 *   - bakiye = gelir - gider (gerçekleşen nakit)
 *   - bekleyen = ödemesi tamamlanmamış kayıtların kalanı (tutar - odenenTutar)
 *
 * NOT (SORU: S7): `bekleyen` hem gelir hem gider açık kalemlerini içerir —
 * müvekkil rozetiyle aynı konvansiyon; büro genel özeti ise yalnız gider sayar.
 * Karar docs/QUESTIONS.md S7'de kullanıcıya bırakıldı; bu testler mevcut
 * davranışı belgeler.
 */

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

describe('finansOzeti — dosya gelir/gider özeti', () => {
  it('boş kayıt listesinde her şey sıfırdır', () => {
    expect(finansOzeti([])).toEqual({
      gelir: 0,
      gider: 0,
      bakiye: 0,
      bekleyen: 0,
    })
  })

  it('gelir ve gider yalnız ÖDENEN tutarı sayar (faturalanmayı değil)', () => {
    // Kısmi ödenen bir gelir: gelir yalnız odenenTutar (3000) olmalı, 8000 değil.
    const ozet = finansOzeti([
      kayit({ yon: 'gelir', kategori: 'vekalet-ucreti', tutar: 8000, odenenTutar: 3000, odemeDurumu: 'kismi' }),
      kayit({ yon: 'gider', tutar: 2000, odenenTutar: 2000, odemeDurumu: 'odendi' }),
    ])
    expect(ozet.gelir).toBe(3000)
    expect(ozet.gider).toBe(2000)
  })

  it('bakiye = gelir - gider (gerçekleşen nakit)', () => {
    const ozet = finansOzeti([
      kayit({ yon: 'gelir', kategori: 'vekalet-ucreti', tutar: 5000, odenenTutar: 5000, odemeDurumu: 'odendi' }),
      kayit({ yon: 'gider', tutar: 1200, odenenTutar: 1200, odemeDurumu: 'odendi' }),
    ])
    expect(ozet.bakiye).toBe(3800)
  })

  it('bekleyen, ödemesi tamamlanmamış kayıtların kalanını toplar', () => {
    const ozet = finansOzeti([
      kayit({ yon: 'gider', tutar: 1000, odenenTutar: 300, odemeDurumu: 'kismi' }),
      kayit({ yon: 'gider', tutar: 500, odenenTutar: 0, odemeDurumu: 'bekliyor' }),
    ])
    // (1000-300) + (500-0) = 1200
    expect(ozet.bekleyen).toBe(1200)
  })

  it('tamamen ödenmiş (odendi) kayıt bekleyene girmez', () => {
    const ozet = finansOzeti([
      kayit({ yon: 'gider', tutar: 700, odenenTutar: 700, odemeDurumu: 'odendi' }),
    ])
    expect(ozet.bekleyen).toBe(0)
  })

  it('MEVCUT davranış (SORU: S7): bekleyen hem gelir hem gider açık kalemini içerir', () => {
    const ozet = finansOzeti([
      kayit({ yon: 'gelir', kategori: 'vekalet-ucreti', tutar: 8000, odenenTutar: 0, odemeDurumu: 'bekliyor' }),
      kayit({ yon: 'gider', tutar: 615, odenenTutar: 0, odemeDurumu: 'bekliyor' }),
    ])
    // 8000 + 615 = 8615 (yön ayrımı yapılmaz)
    expect(ozet.bekleyen).toBe(8615)
    expect(ozet.gelir).toBe(0) // henüz tahsil edilmedi
    expect(ozet.gider).toBe(0) // henüz ödenmedi
  })
})
