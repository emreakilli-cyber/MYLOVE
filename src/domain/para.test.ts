import { describe, expect, it } from 'vitest'
import {
  metindenKurus,
  tutarDuzenlenebilir,
  tutarKisa,
  tutarTam,
  yuzdeDegisim,
  yuzdeMetni,
} from './para'

/*
 * Para hukukî-mali kayıtların temeli: yanlış ayrıştırma → yanlış tutar.
 * Depoda tutar kuruş tam sayısıdır; gösterim Türkçe biçim (₺1.250,50).
 */

describe('tutarTam / tutarKisa', () => {
  it('kuruşu Türkçe lira biçimine çevirir', () => {
    expect(tutarTam(18450000)).toBe('₺184.500,00')
    expect(tutarTam(125050)).toBe('₺1.250,50')
    expect(tutarTam(0)).toBe('₺0,00')
  })

  it('kısa biçim kuruş sıfırken ondalık göstermez, sıfır değilken tam biçime düşer', () => {
    expect(tutarKisa(18450000)).toBe('₺184.500')
    expect(tutarKisa(125050)).toBe('₺1.250,50') // kuruş var → tam biçim
  })
})

describe('metindenKurus — Türkçe/İngilizce karışık ayrıştırma', () => {
  it('ayraçsız tam sayıyı kuruşa çevirir', () => {
    expect(metindenKurus('1250')).toBe(125000)
    expect(metindenKurus('0')).toBe(0)
  })

  it('Türkçe binlik ayracını (nokta) doğru çözer — regresyon koruması', () => {
    // Kritik: "1.250" 1.25 DEĞİL 1250 olmalı.
    expect(metindenKurus('1.250')).toBe(125000)
    expect(metindenKurus('12.345')).toBe(1234500)
    expect(metindenKurus('1.250.000')).toBe(125000000)
  })

  it('Türkçe tam biçimi (nokta binlik + virgül ondalık) çözer', () => {
    expect(metindenKurus('1.250,00')).toBe(125000)
    expect(metindenKurus('1250,50')).toBe(125050)
    expect(metindenKurus('1.234.567,89')).toBe(123456789)
    expect(metindenKurus('12.345,67')).toBe(1234567)
  })

  it('İngilizce biçimi (nokta ondalık, virgül binlik) da çözer', () => {
    expect(metindenKurus('1250.50')).toBe(125050)
    expect(metindenKurus('1,250.50')).toBe(125050)
  })

  it('tek ayraçtan sonra 1–2 rakam varsa ondalık sayar', () => {
    expect(metindenKurus('1,5')).toBe(150)
    expect(metindenKurus('1.5')).toBe(150)
    expect(metindenKurus('1.05')).toBe(105)
  })

  it('para simgesi/boşlukları yok sayar ve negatifi korur', () => {
    expect(metindenKurus('₺1.250,00')).toBe(125000)
    expect(metindenKurus('  1250  ')).toBe(125000)
    expect(metindenKurus('-1250,50')).toBe(-125050)
  })

  it('geçersiz/boş girişte null döner', () => {
    expect(metindenKurus('')).toBeNull()
    expect(metindenKurus('abc')).toBeNull()
    expect(metindenKurus('.')).toBeNull()
    expect(metindenKurus('-')).toBeNull()
  })
})

describe('tutarDuzenlenebilir — düzenleme alanı ön-doldurma biçimi', () => {
  it('kuruşu binlik ayraçlı, para simgesiz Türkçe metne çevirir', () => {
    expect(tutarDuzenlenebilir(1250000)).toBe('12.500,00')
    expect(tutarDuzenlenebilir(50000)).toBe('500,00')
    expect(tutarDuzenlenebilir(50)).toBe('0,50')
    expect(tutarDuzenlenebilir(125000050)).toBe('1.250.000,50')
  })

  it('çıktısı metindenKurus ile kayıpsız gidiş-dönüş yapar — regresyon koruması', () => {
    // Düzenleme formu bu biçimle ön-dolar; kaydederken aynı kuruşa dönmeli.
    for (const kurus of [1, 99, 50, 50000, 400000, 900000, 1250000, 125000050, 100000000]) {
      expect(metindenKurus(tutarDuzenlenebilir(kurus))).toBe(kurus)
    }
  })
})

describe('yuzdeDegisim', () => {
  it('yüzde değişimi hesaplar, payda sıfırsa null', () => {
    expect(yuzdeDegisim(120, 100)).toBe(20)
    expect(yuzdeDegisim(80, 100)).toBe(-20)
    expect(yuzdeDegisim(100, 100)).toBe(0)
    expect(yuzdeDegisim(150, 0)).toBeNull()
  })
})

describe('yuzdeMetni', () => {
  it('işaretli yüzde metni üretir (eksi işareti U+2212)', () => {
    expect(yuzdeMetni(12)).toBe('+%12 geçen aya göre')
    expect(yuzdeMetni(-4)).toBe('−%4 geçen aya göre')
    expect(yuzdeMetni(0)).toBe('geçen ayla aynı')
    expect(yuzdeMetni(null)).toBe('karşılaştırma yok')
  })
})
