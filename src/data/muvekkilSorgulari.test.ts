import { describe, expect, it } from 'vitest'
import { bekleyenOdemeHaritasi } from './muvekkilSorgulari'
import type { FinansKaydi } from '../domain/types'

/*
 * `bekleyenOdemeHaritasi`, müvekkil listesindeki amber "bekleyen ödeme"
 * rozetini besler. Para gösterildiği için toplama kuralı (kalan = tutar -
 * odenenTutar, yalnız `odendi` olmayanlar, müvekkile bağlı olanlar)
 * regresyona karşı kilitlenmeli.
 *
 * NOT (SORU: S7): mevcut davranış GELİR ve GİDER açık kalemlerini birlikte
 * sayar. Bu, büro genel özetinin (yalnız gider) aksinedir. Bu testler MEVCUT
 * davranışı belgeler; anlam kararı docs/QUESTIONS.md S7'de kullanıcıya bırakıldı.
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

describe('bekleyenOdemeHaritasi — müvekkil bazlı bekleyen tutar', () => {
  it('bekleyen kaydın tam kalanını müvekkile ekler', () => {
    const h = bekleyenOdemeHaritasi([
      kayit({ muvekkilId: 'm1', tutar: 2000, odenenTutar: 0 }),
    ])
    expect(h.get('m1')).toBe(2000)
  })

  it('kısmi ödemede yalnız kalanı (tutar - odenenTutar) sayar', () => {
    const h = bekleyenOdemeHaritasi([
      kayit({ muvekkilId: 'm1', tutar: 1000, odenenTutar: 300, odemeDurumu: 'kismi' }),
    ])
    expect(h.get('m1')).toBe(700)
  })

  it('tamamen ödenmiş (odendi) kaydı yok sayar', () => {
    const h = bekleyenOdemeHaritasi([
      kayit({ muvekkilId: 'm1', tutar: 5000, odenenTutar: 5000, odemeDurumu: 'odendi' }),
    ])
    expect(h.has('m1')).toBe(false)
  })

  it('müvekkile bağlı olmayan (muvekkilId yok) kaydı atlar', () => {
    const h = bekleyenOdemeHaritasi([
      kayit({ muvekkilId: undefined, tutar: 9000, odenenTutar: 0 }),
    ])
    expect(h.size).toBe(0)
  })

  it('aynı müvekkilin birden çok açık kaydını toplar', () => {
    const h = bekleyenOdemeHaritasi([
      kayit({ muvekkilId: 'm1', tutar: 1000, odenenTutar: 0 }),
      kayit({ muvekkilId: 'm1', tutar: 2500, odenenTutar: 500, odemeDurumu: 'kismi' }),
      kayit({ muvekkilId: 'm1', tutar: 400, odenenTutar: 400, odemeDurumu: 'odendi' }),
    ])
    // 1000 + (2500-500) + 0 = 3000
    expect(h.get('m1')).toBe(3000)
  })

  it('farklı müvekkilleri ayrı ayrı toplar', () => {
    const h = bekleyenOdemeHaritasi([
      kayit({ muvekkilId: 'm1', tutar: 1000, odenenTutar: 0 }),
      kayit({ muvekkilId: 'm2', tutar: 2000, odenenTutar: 0 }),
    ])
    expect(h.get('m1')).toBe(1000)
    expect(h.get('m2')).toBe(2000)
  })

  it('MEVCUT davranış (SORU: S7): gelir ve gider açık kalemleri birlikte sayılır', () => {
    // Bu, büro genel özetinin (yalnız gider) aksinedir; kasıtlı belge testi.
    const h = bekleyenOdemeHaritasi([
      kayit({ muvekkilId: 'm1', yon: 'gelir', kategori: 'vekalet-ucreti', tutar: 8000, odenenTutar: 0 }),
      kayit({ muvekkilId: 'm1', yon: 'gider', kategori: 'harc', tutar: 615, odenenTutar: 0 }),
    ])
    expect(h.get('m1')).toBe(8615)
  })
})
