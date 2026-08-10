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

/**
 * Girilen tutar metnini kuruşa çevirir. Türkçe-öncelikli, İngilizce uyumlu.
 *
 * Ondalık ayracı belirsizliğini şöyle çözer: iki ayraç (`.` ve `,`) varsa
 * SONDA olan ondalıktır ("1.250,50"→1250.50, "1,250.50"→1250.50). Tek tür ayraç
 * varsa yalnızca ondan sonra **1–2 rakam** geliyorsa ondalıktır ("1,5"→1.5,
 * "1.05"→1.05); aksi hâlde binlik ayracıdır ("1.250"→1250, "12.345"→12345,
 * "1.250.000"→1250000). Böylece Türk kullanıcının "1.250" girişi 1.25'e değil
 * 1250'ye çözülür.
 */
export function metindenKurus(metin: string): Kurus | null {
  const temiz = metin.trim().replace(/[^\d,.-]/g, '')
  const eksi = temiz.startsWith('-')
  const rakamlar = temiz.replace(/-/g, '')
  if (!/\d/.test(rakamlar)) return null

  const sonVirgul = rakamlar.lastIndexOf(',')
  const sonNokta = rakamlar.lastIndexOf('.')

  let ondalikIdx = -1
  if (sonVirgul >= 0 && sonNokta >= 0) {
    // İki ayraç: sonda olan ondalık ayracıdır.
    ondalikIdx = Math.max(sonVirgul, sonNokta)
  } else if (sonVirgul >= 0 || sonNokta >= 0) {
    // Tek tür ayraç: yalnızca sonrasında 1–2 rakam varsa ondalık; aksi hâlde
    // binlik ayracıdır (Türkçe "1.250" = 1250).
    const idx = Math.max(sonVirgul, sonNokta)
    if (rakamlar.length - idx - 1 <= 2) ondalikIdx = idx
  }

  const tam =
    (ondalikIdx >= 0 ? rakamlar.slice(0, ondalikIdx) : rakamlar).replace(
      /[.,]/g,
      '',
    ) || '0'
  const kesir =
    ondalikIdx >= 0 ? rakamlar.slice(ondalikIdx + 1).replace(/[.,]/g, '') : ''

  const sayi = Number(`${tam}.${kesir || '0'}`)
  if (!Number.isFinite(sayi)) return null
  return Math.round((eksi ? -sayi : sayi) * 100)
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
