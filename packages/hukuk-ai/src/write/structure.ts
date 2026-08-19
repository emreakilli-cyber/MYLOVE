/**
 * Yapı/iskelet çıkarma — plan M8.2, `CAPABILITIES.md` A8.
 *
 * Eski dilekçelerden başlık düzeni, numaralandırma şeması ve bölüm sırasını
 * çıkarır. Tamamen deterministiktir — model kullanmaz; A2 süre motorunda
 * olduğu gibi, sınıflandırılabilir bir örüntü olduğu için kural yeterlidir.
 *
 * Bilinen sınır: yalnız satır başı numaralandırma ve TÜM BÜYÜK HARF kısa
 * başlıkları tanır. Serbest biçimli, numarasız düzyazı başlıkları (ör. bir
 * paragrafın ilk cümlesi başlık gibi kullanılmışsa) yakalanmaz — bu durumda
 * `headings` boş kalabilir, çökme olmaz.
 */

export type NumberingStyle = 'roman' | 'arabic' | 'letter' | 'none'

export interface HeadingInfo {
  readonly text: string
  /** Numaralandırma derinliği (`1.2.3` → 3). Numarasız başlıkta 1. */
  readonly level: number
  readonly numbering?: string
}

export interface PetitionStructure {
  readonly headings: readonly HeadingInfo[]
  /** Yalnız üst seviye (level 1) başlıkların metindeki sırası. */
  readonly sectionOrder: readonly string[]
  /** Belgede baskın numaralandırma biçimi; hiç numaralı başlık yoksa `none`. */
  readonly numberingStyle: NumberingStyle
}

const ROMAN_NUMBERING = /^([IVXLCM]+)\.\s*(.+)$/
const ARABIC_NUMBERING = /^(\d+(?:\.\d+)*)\.\s*(.+)$/
const LETTER_NUMBERING = /^([A-ZÇĞİÖŞÜ])\)\s*(.+)$/

const MAX_HEADING_LENGTH = 70

function isAllCapsHeading(line: string): boolean {
  if (line.length === 0 || line.length > MAX_HEADING_LENGTH) return false
  const letters = line.replace(/[^\p{L}]/gu, '')
  if (letters.length === 0) return false
  return letters === letters.toLocaleUpperCase('tr-TR') && letters !== letters.toLocaleLowerCase('tr-TR')
}

function pickDominant(counts: Record<Exclude<NumberingStyle, 'none'>, number>): NumberingStyle {
  let best: NumberingStyle = 'none'
  let bestCount = 0
  for (const style of ['roman', 'arabic', 'letter'] as const) {
    if (counts[style] > bestCount) {
      bestCount = counts[style]
      best = style
    }
  }
  return best
}

export function extractStructure(text: string): PetitionStructure {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const headings: HeadingInfo[] = []
  const counts = { roman: 0, arabic: 0, letter: 0 }

  for (const line of lines) {
    // Gruplar desende zorunludur (`?` yok); boş dizge yalnız TS'in statik
    // garanti edemediği bir durum, çalışma zamanında oluşmaz.
    const arabicMatch = ARABIC_NUMBERING.exec(line)
    if (arabicMatch) {
      const numbering = arabicMatch[1] ?? ''
      headings.push({
        text: (arabicMatch[2] ?? '').trim(),
        level: numbering.split('.').length,
        numbering: `${numbering}.`,
      })
      counts.arabic++
      continue
    }

    const romanMatch = ROMAN_NUMBERING.exec(line)
    if (romanMatch) {
      headings.push({
        text: (romanMatch[2] ?? '').trim(),
        level: 1,
        numbering: `${romanMatch[1] ?? ''}.`,
      })
      counts.roman++
      continue
    }

    const letterMatch = LETTER_NUMBERING.exec(line)
    if (letterMatch) {
      headings.push({
        text: (letterMatch[2] ?? '').trim(),
        level: 1,
        numbering: `${letterMatch[1] ?? ''})`,
      })
      counts.letter++
      continue
    }

    if (isAllCapsHeading(line)) {
      headings.push({ text: line, level: 1 })
    }
  }

  return {
    headings,
    sectionOrder: headings.filter((heading) => heading.level === 1).map((heading) => heading.text),
    numberingStyle: pickDominant(counts),
  }
}
