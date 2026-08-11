import { describe, expect, it } from 'vitest'
import { durumNormalize, odenenKirp } from './finansIslemleri'

/*
 * Finans para mantığı hukukî-mali kayıtların çekirdeği. İki değişmez:
 *  1) odenenKirp: ödenen tutar HER ZAMAN [0, toplam] aralığında kalmalı —
 *     aksi hâlde "bekleyen = tutar − odenen" negatif olur ya da tahsilat
 *     toplamı şişer (row 112'de düzeltilen hata bunun regresyon koruması).
 *  2) durumNormalize: durum ödenen/toplam oranından tutarlı türetilir.
 */

const kurus = (lira: number) => lira * 100 // ₺ → kuruş

describe('odenenKirp — ödenen tutarı [0, toplam] aralığına kırpar', () => {
  it('toplamı aşan ödemeyi toplama kırpar (negatif bakiye üretmez)', () => {
    // ₺1.000 kayda ₺2.000 girilirse ₺1.000 saklanır → bekleyen = 0.
    expect(odenenKirp(kurus(1000), kurus(2000))).toBe(kurus(1000))
  })

  it('negatif ödemeyi sıfıra kırpar (şişmiş bakiye üretmez)', () => {
    expect(odenenKirp(kurus(1000), kurus(-500))).toBe(0)
  })

  it('meşru kısmi ödemeyi olduğu gibi bırakır', () => {
    expect(odenenKirp(kurus(1000), kurus(400))).toBe(kurus(400))
  })

  it('sınır değerleri: 0 ve tam toplam korunur', () => {
    expect(odenenKirp(kurus(1000), 0)).toBe(0)
    expect(odenenKirp(kurus(1000), kurus(1000))).toBe(kurus(1000))
  })

  it('kırpma sonrası bekleyen (tutar − odenen) her zaman ≥ 0', () => {
    const tutar = kurus(1000)
    for (const girilen of [kurus(-100), 0, kurus(400), kurus(1000), kurus(5000)]) {
      const odenen = odenenKirp(tutar, girilen)
      expect(tutar - odenen).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('durumNormalize — durumu ödenen/toplam oranından türetir', () => {
  it('ödenen yoksa "bekliyor"', () => {
    expect(durumNormalize(kurus(1000), 0)).toBe('bekliyor')
    expect(durumNormalize(kurus(1000), kurus(-50))).toBe('bekliyor')
  })

  it('ödenen toplamdan azsa "kısmi"', () => {
    expect(durumNormalize(kurus(1000), kurus(400))).toBe('kismi')
    expect(durumNormalize(kurus(1000), kurus(999))).toBe('kismi')
  })

  it('ödenen toplama eşit ya da fazlaysa "ödendi"', () => {
    expect(durumNormalize(kurus(1000), kurus(1000))).toBe('odendi')
    expect(durumNormalize(kurus(1000), kurus(2000))).toBe('odendi')
  })
})
