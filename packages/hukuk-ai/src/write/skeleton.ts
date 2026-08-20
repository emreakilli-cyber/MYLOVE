/**
 * Yapı/iskelet çıkarma — plan M8.2, `CAPABILITIES.md` A8 adım (a).
 *
 * Eski bir dilekçeden başlık düzenini, numaralandırma şemasını ve bölüm
 * sırasını çıkarır. Model kullanmaz — Türk dilekçelerinin tanıdık başlık
 * biçimlerine (Romen/Arap rakamı, harf, numarasız BÜYÜK HARF başlık) karşı
 * deterministik desen eşlemesidir. Yanlış pozitif riskini kabul ediyoruz
 * (nadir bir BÜYÜK HARF cümle başlık sanılabilir); bedeli düşük çünkü çıktı
 * yalnız üslup profiline ipucu olarak kullanılır, hukuki içeriğe karışmaz.
 */

export type NumberingScheme =
  | 'roman'
  | 'arabic-dot'
  | 'arabic-paren'
  | 'letter-dot'
  | 'letter-paren'
  | 'none'
  | 'mixed'

export interface HeadingLine {
  readonly text: string
  readonly numbering: NumberingScheme
}

export interface DocumentSkeleton {
  readonly headings: readonly HeadingLine[]
  /** Numaralı başlıklar arasında baskın şema; hiç numaralı başlık yoksa `'none'`. */
  readonly numberingScheme: NumberingScheme
  readonly sectionOrder: readonly string[]
}

type NumberedScheme = Exclude<NumberingScheme, 'none' | 'mixed'>

const NUMBERED_PATTERNS: ReadonlyArray<{ scheme: NumberedScheme; pattern: RegExp }> = [
  { scheme: 'roman', pattern: /^[IVXLCDM]+\.\s+(.+)$/ },
  { scheme: 'arabic-dot', pattern: /^\d+\.\s+(.+)$/ },
  { scheme: 'arabic-paren', pattern: /^\d+\)\s+(.+)$/ },
  { scheme: 'letter-dot', pattern: /^[A-ZÇĞİÖŞÜ]\.\s+(.+)$/ },
  { scheme: 'letter-paren', pattern: /^[A-ZÇĞİÖŞÜ]\)\s+(.+)$/ },
]

/**
 * Numarasız ama BÜYÜK HARF yazılmış başlık satırı (`SONUÇ VE İSTEM`, `DELİLLER`).
 * Türk dilekçelerinde çok yaygın; en az iki sözcük ve makul uzunluk şartı
 * arıyoruz ki sıradan bir kısaltma ("TBK") yanlışlıkla başlık sayılmasın.
 */
const BARE_HEADING = /^[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ]*(?:\s+[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ]*)+$/

function isLikelyBareHeading(line: string): boolean {
  return line.length <= 60 && BARE_HEADING.test(line)
}

function matchHeading(line: string): HeadingLine | undefined {
  for (const { scheme, pattern } of NUMBERED_PATTERNS) {
    const match = pattern.exec(line)
    if (match) return { text: (match[1] ?? '').trim(), numbering: scheme }
  }
  if (isLikelyBareHeading(line)) return { text: line, numbering: 'none' }
  return undefined
}

function dominantScheme(schemes: readonly NumberedScheme[]): NumberingScheme {
  if (schemes.length === 0) return 'none'

  const distinct = new Set(schemes)
  if (distinct.size === 1) return schemes[0] as NumberedScheme
  return 'mixed'
}

export function extractSkeleton(text: string): DocumentSkeleton {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const headings: HeadingLine[] = []
  for (const line of lines) {
    const heading = matchHeading(line)
    if (heading) headings.push(heading)
  }

  const numberedSchemes = headings
    .map((heading) => heading.numbering)
    .filter((scheme): scheme is NumberedScheme => scheme !== 'none')

  return {
    headings,
    numberingScheme: dominantScheme(numberedSchemes),
    sectionOrder: headings.map((heading) => heading.text),
  }
}
