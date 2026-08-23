/**
 * Yapı/iskelet çıkarma — plan M8.2, `CAPABILITIES.md` A8 (a).
 *
 * Eski dilekçelerden başlık düzenini, numaralandırma şemasını ve bölüm
 * sırasını çıkarır. Model YOK — tamamen deterministik desen tanıma, tıpkı
 * maskeleme kural katmanı gibi (SPEC §6 felsefesiyle aynı: önce ucuz ve
 * güvenilir kural, model ancak gerekirse).
 *
 * Tanınan üç biçim, Türkçe hukuki dilekçelerde yaygın olanlardır:
 *   - Roma rakamlı üst başlık: `I. GİRİŞ`
 *   - Büyük harf üst başlık (numarasız): `AÇIKLAMALAR`, `SONUÇ VE İSTEM`
 *   - Arap rakamlı madde: `1. Taraflar arasında...`
 *   - Harf parantezli madde: `a) ...`
 */

export type NumberingStyle = 'arabic-dot' | 'roman-dot' | 'letter-paren' | 'none'

export interface SkeletonSection {
  readonly title: string
  readonly numberingStyle: NumberingStyle
  /** 1 = üst başlık, 2 = madde. Daha ince bir hiyerarşi bu sürümde yok. */
  readonly level: 1 | 2
  /** Belgedeki satır indeksi (0 tabanlı) — sıra bilgisini korur. */
  readonly lineIndex: number
}

export interface DocumentSkeleton {
  readonly sections: readonly SkeletonSection[]
  /** Madde numaralandırmasında en sık görülen biçim; hiç yoksa `'none'`. */
  readonly dominantNumberingStyle: NumberingStyle
}

const ROMAN_HEADING = /^([IVXLCDM]{1,7})\.\s+(.+)$/
const ARABIC_ITEM = /^(\d{1,3})\.\s+(.+)$/
const LETTER_ITEM = /^([a-zçğıöşüA-ZÇĞİÖŞÜ])\)\s+(.+)$/u
const ALL_CAPS_HEADING = /^[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ0-9\s.,:;-]{1,58}$/u

function isAllCapsHeading(line: string): boolean {
  if (line.length < 3 || line.length > 60) return false
  if (!ALL_CAPS_HEADING.test(line)) return false
  // Yalnız noktalama/boşluktan oluşan satır başlık sayılmaz.
  return /\p{L}/u.test(line)
}

/**
 * Belgeden başlık/madde listesini ve baskın numaralandırma biçimini çıkarır.
 * Girdi zaten (varsa) maskelenmiş olabilir ya da olmayabilir — bu modül
 * kimlik verisiyle ilgilenmez, yalnız biçimle ilgilenir.
 */
export function extractSkeleton(document: string): DocumentSkeleton {
  const lines = document.split(/\r?\n/)
  const sections: SkeletonSection[] = []

  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.trim()
    if (line.length === 0) return

    const roman = ROMAN_HEADING.exec(line)
    if (roman) {
      sections.push({ title: roman[2]!.trim(), numberingStyle: 'roman-dot', level: 1, lineIndex })
      return
    }

    const arabic = ARABIC_ITEM.exec(line)
    if (arabic) {
      sections.push({ title: arabic[2]!.trim(), numberingStyle: 'arabic-dot', level: 2, lineIndex })
      return
    }

    const letter = LETTER_ITEM.exec(line)
    if (letter) {
      sections.push({ title: letter[2]!.trim(), numberingStyle: 'letter-paren', level: 2, lineIndex })
      return
    }

    if (isAllCapsHeading(line)) {
      sections.push({ title: line, numberingStyle: 'none', level: 1, lineIndex })
    }
  })

  const counts = new Map<NumberingStyle, number>()
  for (const section of sections) {
    if (section.numberingStyle === 'none') continue
    counts.set(section.numberingStyle, (counts.get(section.numberingStyle) ?? 0) + 1)
  }

  let dominantNumberingStyle: NumberingStyle = 'none'
  let max = 0
  // Map iterasyonu ekleme sırasıyla gider (belgedeki ilk görülme sırası) —
  // eşitlikte belgede önce görülen biçim kazanır, sonuç deterministiktir.
  for (const [style, count] of counts) {
    if (count > max) {
      dominantNumberingStyle = style
      max = count
    }
  }

  return { sections, dominantNumberingStyle }
}
