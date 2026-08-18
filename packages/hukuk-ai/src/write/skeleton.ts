/**
 * Yapı/iskelet çıkarma — plan M8.2, `CAPABILITIES.md` A8/A13.
 *
 * Eski dilekçelerden başlık düzenini, numaralandırma şemasını ve bölüm
 * sırasını çıkarır. Bu bir dilbilgisi çözümleyicisi değil; hukuki dilekçe
 * biçiminde sık görülen kalıplara dayanan denetimli bir sezgiseldir — tıpkı
 * `turkish/suffix.ts`'nin genel bir morfoloji çözümleyicisi olmaması gibi.
 */

export type NumberingScheme = 'decimal' | 'roman' | 'alpha' | 'none' | 'mixed'

export interface SkeletonHeading {
  /** Numaralandırma etiketi ayıklanmış başlık metni. */
  readonly text: string
  /** 0 tabanlı satır numarası — kaynağa geri işaret eder. */
  readonly line: number
  /** Ham numaralandırma etiketi (`"1."`, `"II."`, `"A)"`) veya yoksa `null`. */
  readonly numberLabel: string | null
  readonly scheme: Exclude<NumberingScheme, 'none' | 'mixed'> | null
}

export interface DocumentSkeleton {
  readonly headings: readonly SkeletonHeading[]
  readonly numberingScheme: NumberingScheme
  /** Başlık metinleri, belgedeki sırayla — bölüm sırası. */
  readonly sectionOrder: readonly string[]
}

const ROMAN_LABEL = /^[IVXLCDM]+$/
const DECIMAL_LABEL = /^\d+(?:\.\d+)*$/
const ALPHA_LABEL = /^[A-ZÇĞİÖŞÜ]$/u

/** Başlık satırının önündeki numaralandırma etiketini ayırır. */
function matchLabel(line: string): { label: string; scheme: Exclude<NumberingScheme, 'none' | 'mixed'>; rest: string } | undefined {
  const match = /^\s*([IVXLCDM]+|\d+(?:\.\d+)*|[A-ZÇĞİÖŞÜ])[.)]\s*[-–—]?\s*(\S.*)$/u.exec(line)
  if (!match) return undefined

  const [, label, rest] = match
  if (label === undefined || rest === undefined) return undefined

  if (DECIMAL_LABEL.test(label)) return { label, scheme: 'decimal', rest }
  if (ROMAN_LABEL.test(label)) return { label, scheme: 'roman', rest }
  if (ALPHA_LABEL.test(label)) return { label, scheme: 'alpha', rest }
  return undefined
}

/**
 * Sık görülen hukuki dilekçe bölüm başlıkları — numarasız ama büyük harfle
 * yazılan, kendi başına başlık sayılması gereken satırlar.
 */
const KNOWN_SECTION_WORDS = [
  'KONU', 'AÇIKLAMALAR', 'İZAH', 'SONUÇ VE İSTEM', 'SONUÇ VE TALEP',
  'HUKUKİ SEBEPLER', 'HUKUKİ NEDENLER', 'DELİLLER', 'İSTİNAF SEBEPLERİ',
  'TEMYİZ SEBEPLERİ', 'TALEP', 'İSTEM',
]

function isAllCapsHeading(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length === 0 || trimmed.length > 60) return false

  const letters = trimmed.replace(/[^\p{L}]/gu, '')
  if (letters.length < 3) return false
  if (letters !== letters.toLocaleUpperCase('tr')) return false

  const startsWithKnown = KNOWN_SECTION_WORDS.some((word) => trimmed.toLocaleUpperCase('tr').startsWith(word))
  // Kısa, tamamı büyük harf satırlar zaten güçlü bir başlık ipucu; bilinen
  // kelimeyle başlıyorsa daha da güvenli.
  return startsWithKnown || trimmed.length <= 40
}

/** Metindeki başlıkları, numaralandırma etiketleriyle birlikte çıkarır. */
export function extractSkeleton(text: string): DocumentSkeleton {
  const lines = text.split('\n')
  const headings: SkeletonHeading[] = []

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim()
    if (line.length === 0) return

    const labeled = matchLabel(line)
    if (labeled) {
      headings.push({ text: labeled.rest.trim(), line: index, numberLabel: labeled.label, scheme: labeled.scheme })
      return
    }

    if (isAllCapsHeading(line)) {
      headings.push({ text: line, line: index, numberLabel: null, scheme: null })
    }
  })

  const schemes = new Set(headings.map((heading) => heading.scheme).filter((scheme) => scheme !== null))
  const numberingScheme: NumberingScheme =
    schemes.size === 0 ? 'none' : schemes.size > 1 ? 'mixed' : ([...schemes][0] ?? 'none')

  return {
    headings,
    numberingScheme,
    sectionOrder: headings.map((heading) => heading.text),
  }
}
