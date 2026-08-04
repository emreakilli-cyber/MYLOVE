import type { Kurus } from './types'

/*
 * Para biçimlendirme. Depoda her tutar kuruş tam sayısı; gösterimde Türkçe
 * ayraçlarla lira. 18450000 → "₺184.500"
 */

const tamBicim = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const kisaBicim = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** "₺184.500,00" — finans listeleri ve makbuzlar. */
export function tutarTam(kurus: Kurus): string {
  return tamBicim.format(kurus / 100)
}

/**
 * "₺184.500" — gösterge panelindeki büyük sayı.
 * Kuruş sıfır değilse yuvarlama yanıltmasın diye tam biçime düşer.
 */
export function tutarKisa(kurus: Kurus): string {
  return kurus % 100 === 0 ? kisaBicim.format(kurus / 100) : tutarTam(kurus)
}

/** Girilen "1.250,50" ya da "1250.50" metnini kuruşa çevirir. */
export function metindenKurus(metin: string): Kurus | null {
  const temiz = metin.trim().replace(/[^\d,.-]/g, '')
  if (!temiz) return null

  // Türkçe girişte nokta binlik, virgül ondalık ayraçtır.
  const sonVirgul = temiz.lastIndexOf(',')
  const sonNokta = temiz.lastIndexOf('.')
  let normal: string

  if (sonVirgul > sonNokta) {
    normal = temiz.replace(/\./g, '').replace(',', '.')
  } else if (sonNokta > sonVirgul) {
    normal = temiz.replace(/,/g, '')
  } else {
    normal = temiz
  }

  const sayi = Number(normal)
  if (!Number.isFinite(sayi)) return null
  return Math.round(sayi * 100)
}

/** Değişim oranı: geçen aya göre yüzde. Payda sıfırsa null. */
export function yuzdeDegisim(simdiki: number, onceki: number): number | null {
  if (onceki === 0) return null
  return Math.round(((simdiki - onceki) / onceki) * 100)
}

/** "+%12", "-%4", "değişim yok" */
export function yuzdeMetni(yuzde: number | null): string {
  if (yuzde === null) return 'karşılaştırma yok'
  if (yuzde === 0) return 'geçen ayla aynı'
  const isaret = yuzde > 0 ? '+' : '−'
  return `${isaret}%${Math.abs(yuzde)} geçen aya göre`
}
