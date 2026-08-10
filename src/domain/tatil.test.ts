import { describe, expect, it } from 'vitest'
import {
  adliTatilUzamaGunu,
  adliTatildeMi,
  calismaGunuDegilMi,
  haftaSonuMu,
  ilkCalismaGunu,
  resmiTatilMi,
  tatilAdi,
} from './tatil'

/*
 * Tatil kuralları hukuken en hassas çekirdek: yanlış tatil → yanlış son gün.
 * Bu yüzden doğrudan birim testlerle sabitleniyor (2026 referans yılı; hafta
 * günleri UTC ortamında `.getDay()` ile doğrulandı).
 *
 * 2026 dinî bayramlar (tatil.ts tablosu): Ramazan 20–22 Mart, Kurban 27–30 Mayıs.
 * Arefe günleri (19 Mart, 26 Mayıs) yarım gün — TAM tatil sayılmaz.
 */

describe('haftaSonuMu', () => {
  it('cumartesi ve pazarı hafta sonu sayar, hafta içini saymaz', () => {
    expect(haftaSonuMu('2026-03-21')).toBe(true) // Cmt
    expect(haftaSonuMu('2026-03-22')).toBe(true) // Paz
    expect(haftaSonuMu('2026-03-23')).toBe(false) // Pzt
    expect(haftaSonuMu('2026-06-15')).toBe(false) // Pzt
  })
})

describe('resmiTatilMi', () => {
  it('sabit tarihli tam gün tatilleri tanır', () => {
    expect(resmiTatilMi('2026-01-01')).toBe(true) // Yılbaşı
    expect(resmiTatilMi('2026-04-23')).toBe(true) // 23 Nisan
    expect(resmiTatilMi('2026-08-30')).toBe(true) // 30 Ağustos
    expect(resmiTatilMi('2026-10-29')).toBe(true) // 29 Ekim
  })

  it('dinî bayramın her gününü tanır (çok günlü aralık)', () => {
    // Ramazan 20–22 Mart
    expect(resmiTatilMi('2026-03-20')).toBe(true)
    expect(resmiTatilMi('2026-03-22')).toBe(true)
    // Kurban 27–30 Mayıs
    expect(resmiTatilMi('2026-05-27')).toBe(true)
    expect(resmiTatilMi('2026-05-30')).toBe(true)
  })

  it('arefe günü ve bayram sonrası ilk günü tam tatil saymaz', () => {
    expect(resmiTatilMi('2026-05-26')).toBe(false) // Kurban arefesi (yarım gün)
    expect(resmiTatilMi('2026-05-31')).toBe(false) // Kurban sonrası (pazar ama resmî tatil değil)
    expect(resmiTatilMi('2026-03-23')).toBe(false) // Ramazan sonrası ilk gün
  })

  it('sıradan hafta sonunu resmî tatil saymaz (yalnızca sabit/dinî)', () => {
    expect(resmiTatilMi('2026-03-14')).toBe(false) // sıradan cumartesi
    expect(resmiTatilMi('2026-06-01')).toBe(false) // sıradan pazartesi
  })
})

describe('calismaGunuDegilMi', () => {
  it('hafta sonu VEYA resmî tatilde true, normal iş gününde false', () => {
    expect(calismaGunuDegilMi('2026-06-01')).toBe(false) // Pzt normal
    expect(calismaGunuDegilMi('2026-03-21')).toBe(true) // Cmt
    expect(calismaGunuDegilMi('2026-04-23')).toBe(true) // resmî tatil (Per)
  })
})

describe('ilkCalismaGunu', () => {
  it('zaten iş günüyse aynı günü döndürür', () => {
    expect(ilkCalismaGunu('2026-06-01')).toBe('2026-06-01') // Pzt
    expect(ilkCalismaGunu('2026-05-26')).toBe('2026-05-26') // arefe = iş günü
  })

  it('hafta sonunu ilk pazartesiye taşır', () => {
    expect(ilkCalismaGunu('2026-03-21')).toBe('2026-03-23') // Cmt → Pzt
  })

  it('resmî tatili sonraki iş gününe taşır', () => {
    expect(ilkCalismaGunu('2026-04-23')).toBe('2026-04-24') // 23 Nisan Per → Cum
  })

  it('bayram + hafta sonu zincirini tümüyle aşar', () => {
    // Kurban 27–30 Mayıs (30'u Cmt), 31 Mayıs Paz → ilk iş günü 1 Haziran Pzt
    expect(ilkCalismaGunu('2026-05-27')).toBe('2026-06-01')
  })
})

describe('tatilAdi', () => {
  it('hafta sonu ve tatiller için gerekçe adı verir, iş gününde null', () => {
    expect(tatilAdi('2026-03-21')).toBe('cumartesi')
    expect(tatilAdi('2026-03-22')).toBe('pazar')
    expect(tatilAdi('2026-01-01')).toBe('yılbaşı')
    expect(tatilAdi('2026-04-23')).toBe('23 Nisan')
    expect(tatilAdi('2026-05-27')).toBe('dinî bayram') // Kurban (Çar)
    expect(tatilAdi('2026-06-01')).toBeNull() // normal iş günü
  })
})

describe('adliTatildeMi', () => {
  it('20 Temmuz – 31 Ağustos aralığını (uçlar dahil) doğru sınırlar', () => {
    expect(adliTatildeMi('2026-07-19')).toBe(false) // bir gün önce
    expect(adliTatildeMi('2026-07-20')).toBe(true) // başlangıç
    expect(adliTatildeMi('2026-07-31')).toBe(true)
    expect(adliTatildeMi('2026-08-01')).toBe(true)
    expect(adliTatildeMi('2026-08-31')).toBe(true) // bitiş
    expect(adliTatildeMi('2026-09-01')).toBe(false) // bir gün sonra
    expect(adliTatildeMi('2026-06-15')).toBe(false) // aralık dışı
  })
})

describe('adliTatilUzamaGunu', () => {
  it('adli tatile denk gelen sürede o yılın 7 Eylül’ünü verir (HMK m.104)', () => {
    expect(adliTatilUzamaGunu('2026-08-15')).toBe('2026-09-07')
    expect(adliTatilUzamaGunu('2027-07-25')).toBe('2027-09-07')
  })
})
