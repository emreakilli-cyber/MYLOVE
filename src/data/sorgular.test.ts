import { describe, expect, it } from 'vitest'
import { durumNotuUret } from './sorgular'
import type { Sure } from '../domain/types'

/*
 * `durumNotuUret` dosya kartındaki "şu an neyi bekliyor" cümlesini üretir.
 * Hukuki süre doğruluğu kritik: son günü GEÇMİŞ açık bir süre "yaklaşıyor"
 * denmemeli (geçmiştir). Aynı gün (fark 0) hâlâ son gündür → "yaklaşıyor".
 */

const AN = '2026-01-01T00:00:00.000Z'

function acikSure(sonTarih: string): Sure {
  return {
    id: `s-${sonTarih}`,
    olusturmaTarihi: AN,
    guncellemeTarihi: AN,
    dosyaId: 'd1',
    kuralId: 'istinaf-hmk-345',
    kuralAdi: 'İstinaf süresi',
    kanunReferansi: 'HMK m. 345',
    baslangicTarihi: '2020-01-01',
    hamSonTarih: sonTarih,
    sonTarih,
    durum: 'acik',
  }
}

describe('durumNotuUret — açık süre ifadesi', () => {
  it('son günü geçmiş açık süre "geçti" der, "yaklaşıyor" demez', () => {
    const not = durumNotuUret([], [acikSure('2020-06-01')], [])
    expect(not).toBe('İstinaf süresi son günü geçti')
  })

  it('vadesi gelmemiş açık süre "yaklaşıyor" der', () => {
    const not = durumNotuUret([], [acikSure('2099-12-31')], [])
    expect(not).toBe('İstinaf süresi yaklaşıyor')
  })

  it('tamamlanmış süre yok sayılır (açık süre yoksa cümle düşer)', () => {
    const tamam = { ...acikSure('2020-06-01'), durum: 'tamamlandi' as const }
    const not = durumNotuUret([], [tamam], [])
    expect(not).not.toContain('İstinaf')
    expect(not).toBe('Belge bekleniyor')
  })
})
