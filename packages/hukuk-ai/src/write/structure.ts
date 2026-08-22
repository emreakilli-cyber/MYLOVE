/**
 * Yapı/iskelet çıkarma — plan M8.2, `docs/CAPABILITIES.md` A8.
 *
 * "Eski dilekçelerden başlık düzeni, numaralandırma şeması, bölüm sırası."
 * Tamamen deterministiktir — model gerekmez, üslup öğrenmenin (a) adımı budur
 * ve model olmadan da çalışır (M3.3 ile aynı ilke).
 */

const UPPER_LETTER = /[A-ZÇĞİÖŞÜ]/
const LOWER_LETTER = /[a-zçğıöşü]/
const HEADING_CHARSET = /^[0-9A-ZÇĞİÖŞÜ\s.,:'"()/-]+$/

/** Satır, gövde metni değil bölüm başlığı gibi görünüyor mu (tamamı büyük harf). */
function isHeadingLine(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length < 3 || trimmed.length > 80) return false
  if (LOWER_LETTER.test(trimmed)) return false
  if (!UPPER_LETTER.test(trimmed)) return false
  return HEADING_CHARSET.test(trimmed)
}

export type NumberingStyle = 'arabic' | 'roman' | 'letter' | 'none'

const NUMBERING_PATTERNS: readonly { readonly style: Exclude<NumberingStyle, 'none'>; readonly pattern: RegExp }[] = [
  { style: 'arabic', pattern: /^\d+[.)]\s+\S/ },
  { style: 'roman', pattern: /^[IVXLCM]+[.)]\s+\S/ },
  { style: 'letter', pattern: /^[a-zçğıöşü]\)\s+\S/ },
]

export interface DocumentStructure {
  /** Bölüm başlıkları, metindeki geçiş sırasıyla — bölüm sırası budur. */
  readonly headings: readonly string[]
  /** Gövdede en sık kullanılan sıralı liste biçimi. */
  readonly numberingStyle: NumberingStyle
}

/**
 * Metni satır satır tarar; başlık gibi görünen satırları toplar, gövdedeki
 * sıralı liste öğelerinden baskın numaralandırma biçimini çıkarır.
 *
 * Sıralama önceliği sabittir (`NUMBERING_PATTERNS` sırası): eşit sayıda
 * eşleşmede sonuç her zaman aynı olur.
 */
export function extractStructure(text: string): DocumentStructure {
  const headings: string[] = []
  const counts: Record<Exclude<NumberingStyle, 'none'>, number> = {
    arabic: 0,
    roman: 0,
    letter: 0,
  }

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (line.length === 0) continue

    if (isHeadingLine(line)) {
      headings.push(line)
      continue
    }

    for (const { style, pattern } of NUMBERING_PATTERNS) {
      if (pattern.test(line)) {
        counts[style] += 1
        break
      }
    }
  }

  const dominant = NUMBERING_PATTERNS.map(({ style }) => style)
    .reduce<{ style: NumberingStyle; count: number }>(
      (best, style) => (counts[style] > best.count ? { style, count: counts[style] } : best),
      { style: 'none', count: 0 },
    )

  return { headings, numberingStyle: dominant.style }
}
