import { describe, expect, it } from 'vitest'
import { kuralBul, sureHesapla, SURE_KATALOGU } from './sureHesabi'
import {
  adliTatildeMi,
  haftaSonuMu,
  ilkCalismaGunu,
  resmiTatilMi,
} from './tatil'

/*
 * Süre motoru uygulamanın en hassas parçası: yanlış bir son gün, kaçırılmış
 * bir itiraz demek. Bilinen tarihler elle hesaplanıp buraya sabitlendi.
 * (Gün adları ayrıca doğrulandı: 2026-01-05 Pzt, -01-17 Cmt, -10-29 Per
 * Cumhuriyet Bayramı, -09-07 Pzt.)
 */

function kural(id: string) {
  const k = kuralBul(id)
  if (!k) throw new Error(`kural yok: ${id}`)
  return k
}

describe('tatil takvimi', () => {
  it('sabit resmî tatilleri tanır', () => {
    expect(resmiTatilMi('2026-01-01')).toBe(true) // yılbaşı
    expect(resmiTatilMi('2026-04-23')).toBe(true) // 23 Nisan
    expect(resmiTatilMi('2026-10-29')).toBe(true) // Cumhuriyet Bayramı
    expect(resmiTatilMi('2026-08-30')).toBe(true) // Zafer Bayramı
    expect(resmiTatilMi('2026-06-15')).toBe(false) // normal gün
  })

  it('dinî bayramları tanır (Diyanet tablosu)', () => {
    // 2026 Ramazan Bayramı 20–22 Mart
    expect(resmiTatilMi('2026-03-20')).toBe(true)
    expect(resmiTatilMi('2026-03-22')).toBe(true)
    expect(resmiTatilMi('2026-03-23')).toBe(false)
    // 2026 Kurban Bayramı 27–30 Mayıs
    expect(resmiTatilMi('2026-05-27')).toBe(true)
    expect(resmiTatilMi('2026-05-30')).toBe(true)
    // Arefe tam tatil değildir
    expect(resmiTatilMi('2026-05-26')).toBe(false)
  })

  it('hafta sonunu ayırır', () => {
    expect(haftaSonuMu('2026-01-10')).toBe(true) // cumartesi
    expect(haftaSonuMu('2026-01-11')).toBe(true) // pazar
    expect(haftaSonuMu('2026-01-12')).toBe(false) // pazartesi
  })

  it('ilk çalışma gününü bulur', () => {
    // 17 Ocak cumartesi → 19 Ocak pazartesi
    expect(ilkCalismaGunu('2026-01-17')).toBe('2026-01-19')
    // 29 Ekim (Per, Cumhuriyet Bayramı) → 30 Ekim (Cum)
    expect(ilkCalismaGunu('2026-10-29')).toBe('2026-10-30')
    // Zaten çalışma günüyse aynı gün
    expect(ilkCalismaGunu('2026-01-19')).toBe('2026-01-19')
  })

  it('adli tatil aralığını doğru sınırlar', () => {
    expect(adliTatildeMi('2026-07-19')).toBe(false)
    expect(adliTatildeMi('2026-07-20')).toBe(true) // başlangıç
    expect(adliTatildeMi('2026-08-31')).toBe(true) // bitiş
    expect(adliTatildeMi('2026-09-01')).toBe(false)
  })
})

describe('süre hesabı', () => {
  it('hafta süresini temiz bir haftaya ekler (tebliğ günü sayılmaz)', () => {
    const s = sureHesapla(kural('istinaf-hmk-345'), '2026-01-05')
    expect(s.hamSonTarih).toBe('2026-01-19') // +14 gün
    expect(s.sonTarih).toBe('2026-01-19') // kaydırma yok
    expect(s.gerekceler).toHaveLength(0)
    expect(s.adliTatilUygulandi).toBe(false)
  })

  it('gün süresini doğru ekler', () => {
    const s = sureHesapla(kural('odeme-emrine-itiraz-iik-62'), '2026-01-05')
    expect(s.hamSonTarih).toBe('2026-01-12') // +7 gün
  })

  it('son gün hafta sonuna denk gelince ilk iş gününe kaydırır', () => {
    // 10 Ocak cumartesi + 7 gün = 17 Ocak cumartesi → 19 Ocak pazartesi
    const s = sureHesapla(kural('odeme-emrine-itiraz-iik-62'), '2026-01-10')
    expect(s.hamSonTarih).toBe('2026-01-17')
    expect(s.sonTarih).toBe('2026-01-19')
    expect(s.gerekceler[0]).toContain('cumartesi')
  })

  it('son gün resmî tatile denk gelince kaydırır', () => {
    // 22 Ekim + 7 = 29 Ekim (Cumhuriyet Bayramı) → 30 Ekim
    const s = sureHesapla(kural('odeme-emrine-itiraz-iik-62'), '2026-10-22')
    expect(s.hamSonTarih).toBe('2026-10-29')
    expect(s.sonTarih).toBe('2026-10-30')
    expect(s.gerekceler[0]).toContain('Cumhuriyet')
  })

  it('adli tatile tabi süre, tatile denk gelirse 7 Eylül’e uzar', () => {
    // İstinaf 2 hafta, 20 Temmuz → ham 3 Ağustos (adli tatilde) → 7 Eylül (Pzt)
    const s = sureHesapla(kural('istinaf-hmk-345'), '2026-07-20')
    expect(s.hamSonTarih).toBe('2026-08-03')
    expect(s.adliTatilUygulandi).toBe(true)
    expect(s.sonTarih).toBe('2026-09-07')
    expect(s.gerekceler.some((g) => g.includes('adli tatil'))).toBe(true)
  })

  it('adli tatile tabi olmayan icra süresi uzamaz', () => {
    // Ödeme emri 7 gün, 10 Ağustos → ham 17 Ağustos (Pzt, adli tatilde ama tabi değil)
    const s = sureHesapla(kural('odeme-emrine-itiraz-iik-62'), '2026-08-10')
    expect(s.hamSonTarih).toBe('2026-08-17')
    expect(s.sonTarih).toBe('2026-08-17') // kaydırma yok
    expect(s.adliTatilUygulandi).toBe(false)
  })

  it('ay süresinde olmayan güne denk gelince ay sonuna sabitler', () => {
    // İşe iade 1 ay, 31 Ocak → 28 Şubat (2026 artık yıl değil)
    const s = sureHesapla(kural('ise-iade-arabulucu-7036'), '2026-01-31')
    expect(s.hamSonTarih).toBe('2026-02-28')
  })

  it('yıl süresini doğru ekler', () => {
    const s = sureHesapla(kural('itirazin-iptali-iik-67'), '2026-03-16')
    expect(s.hamSonTarih).toBe('2027-03-16')
  })

  it('kaydırılmış son tarih her zaman bir çalışma günüdür', () => {
    // Kataloğun tamamını birkaç başlangıçla tara.
    const baslangiclar = ['2026-07-15', '2026-08-25', '2026-12-28', '2026-04-20']
    for (const kural of SURE_KATALOGU) {
      for (const bas of baslangiclar) {
        const s = sureHesapla(kural, bas)
        expect(haftaSonuMu(s.sonTarih), `${kural.id} @ ${bas}`).toBe(false)
        expect(resmiTatilMi(s.sonTarih), `${kural.id} @ ${bas}`).toBe(false)
      }
    }
  })
})
