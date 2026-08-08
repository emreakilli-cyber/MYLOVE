/**
 * Yapı/iskelet çıkarma — plan M8.2, `CAPABILITIES.md` A8.
 *
 * Eski dilekçelerden başlık düzeni, numaralandırma şeması ve bölüm sırası
 * çıkarılır. Tamamen deterministiktir — model gerekmez; bu yüzden ağ
 * erişimi de gerekmez (M8.1).
 */

export type NumberingStyle = 'arabic-dot' | 'arabic-paren' | 'roman' | 'letter' | 'none' | 'mixed'

export interface SkeletonSection {
  readonly heading: string
  /** 1 = ana başlık (`DAVACI`, `SONUÇ VE İSTEM`…), 2 = numaralandırılmış alt madde. */
  readonly level: 1 | 2
  readonly order: number
}

export interface DocumentSkeleton {
  readonly sections: readonly SkeletonSection[]
  readonly numberingStyle: NumberingStyle
}

const ROMAN_HEADING = /^[IVXLCDM]+[.)]\s*\S/
const LETTER_HEADING = /^[A-ZÇĞİÖŞÜ][.)]\s*\S/
const ARABIC_DOT_HEADING = /^\d+(?:\.\d+)*\.\s*\S/
const ARABIC_PAREN_HEADING = /^\d+\)\s*\S/

type NumberedStyle = Exclude<NumberingStyle, 'none' | 'mixed'>

function classifyNumbering(line: string): NumberedStyle | undefined {
  if (ARABIC_DOT_HEADING.test(line)) return 'arabic-dot'
  if (ARABIC_PAREN_HEADING.test(line)) return 'arabic-paren'
  if (ROMAN_HEADING.test(line)) return 'roman'
  if (LETTER_HEADING.test(line)) return 'letter'
  return undefined
}

/** Kısa, tamamen büyük harfli satır — `DAVACI`, `HUKUKİ SEBEPLER` gibi ana başlıklar. */
function isAllCapsHeading(line: string): boolean {
  if (line.length < 2 || line.length > 80) return false
  const letters = line.replace(/[^\p{L}]/gu, '')
  if (letters.length === 0) return false
  return letters === letters.toLocaleUpperCase('tr') && letters !== letters.toLocaleLowerCase('tr')
}

function resolveNumberingStyle(counts: Readonly<Record<string, number>>): NumberingStyle {
  const entries = Object.entries(counts).filter(([, count]) => count > 0)
  if (entries.length === 0) return 'none'
  entries.sort((a, b) => b[1] - a[1])
  const [topStyle, topCount] = entries[0]!
  const runnerUpCount = entries[1]?.[1] ?? 0
  if (runnerUpCount === topCount && entries.length > 1) return 'mixed'
  return topStyle as NumberingStyle
}

/** Belge metninden başlık düzeni + numaralandırma şeması çıkarır (M8.2). */
export function extractSkeleton(documentText: string): DocumentSkeleton {
  const lines = documentText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const sections: SkeletonSection[] = []
  const numberingCounts: Record<string, number> = {}
  let order = 0

  for (const line of lines) {
    const numbering = classifyNumbering(line)
    if (numbering) {
      numberingCounts[numbering] = (numberingCounts[numbering] ?? 0) + 1
      sections.push({ heading: line, level: 2, order })
      order += 1
      continue
    }
    if (isAllCapsHeading(line)) {
      sections.push({ heading: line, level: 1, order })
      order += 1
    }
  }

  return { sections, numberingStyle: resolveNumberingStyle(numberingCounts) }
}
