/**
 * Yapı/iskelet çıkarma — plan M8.2.
 *
 * Eski bir dilekçeden başlık düzenini, numaralandırma şemasını ve bölüm
 * sırasını çıkarır. Tamamen deterministiktir (kural katmanı gibi) — model
 * gerektirmez. `CAPABILITIES.md` A8: üslup profili çıkarımının "yapı" ayağı.
 *
 * Bilinen sınır: Türkçe dilekçe biçimleri çok çeşitlidir; burada tanınan
 * kalıplar (Romen rakamı, noktalı Arap rakamı, harf listesi, Türkçe sıra
 * sayı sözcükleri, TAMAMI BÜYÜK HARF satırlar) en yaygın olanlardır. Tanınmayan
 * bir biçim başlık olarak işaretlenmez — sessizce atlanır, uydurulmaz.
 */

export type NumberingScheme =
  | 'roman' // I., II., III.
  | 'arabic-dot' // 1., 1.1., 1.1.2.
  | 'letter' // a), b)
  | 'turkish-ordinal' // BİRİNCİ, İKİNCİ...
  | 'none' // yalnız BÜYÜK HARF satır, numarasız
  | 'mixed'

export interface HeadingInfo {
  readonly text: string
  /** 1 = en üst seviye; noktalı Arap rakamında nokta sayısı derinliği belirler. */
  readonly level: number
  /** Ham numaralandırma dizgesi (`I.`, `1.2.`, `a)`…); numarasızsa `null`. */
  readonly numbering: string | null
  readonly scheme: NumberingScheme
  /** Kaynak metindeki satır başlangıç konumu. */
  readonly start: number
}

export interface DocumentStructure {
  readonly headings: readonly HeadingInfo[]
  /** Başlık metinleri, metindeki sırayla. */
  readonly sectionOrder: readonly string[]
  /** Belgede baskın numaralandırma biçimi. */
  readonly numberingScheme: NumberingScheme
}

const ROMAN = /^([IVXLCDM]+)\.\s+(.+)$/
const ARABIC_DOT = /^(\d+(?:\.\d+)*)\.\s+(.+)$/
const LETTER = /^([a-zçğıöşü])\)\s+(.+)$/i
const TURKISH_ORDINAL =
  /^(BİRİNCİ|İKİNCİ|ÜÇÜNCÜ|DÖRDÜNCÜ|BEŞİNCİ|ALTINCI|YEDİNCİ|SEKİZİNCİ|DOKUZUNCU|ONUNCU)\s+(.+)$/i

/** TAMAMI BÜYÜK HARF, kısa (≤ 60 karakter), noktayla bitmeyen bağımsız satır. */
function isBareCapsHeading(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length === 0 || trimmed.length > 60) return false
  if (trimmed.endsWith('.') || trimmed.endsWith(',')) return false
  // `DAVACI: [KISI_1]` gibi alan etiketleri başlık değildir — bunlar
  // "etiket: değer" biçimindeki bilgi satırlarıdır, bölüm başlığı değil.
  if (trimmed.includes(':')) return false
  const upper = trimmed.toLocaleUpperCase('tr')
  if (trimmed !== upper) return false
  // En az bir harf içermeli — yalnız noktalama/sayı satırlarını eleriz.
  return /\p{L}/u.test(trimmed)
}

function detectHeading(line: string): Omit<HeadingInfo, 'start'> | undefined {
  const roman = ROMAN.exec(line)
  if (roman) {
    return { text: roman[2] ?? '', level: 1, numbering: roman[1] ?? null, scheme: 'roman' }
  }

  const arabic = ARABIC_DOT.exec(line)
  if (arabic) {
    const numbering = arabic[1] ?? ''
    const level = numbering.split('.').length
    return { text: arabic[2] ?? '', level, numbering, scheme: 'arabic-dot' }
  }

  const ordinal = TURKISH_ORDINAL.exec(line)
  if (ordinal) {
    return {
      text: `${ordinal[1]} ${ordinal[2]}`.trim(),
      level: 1,
      numbering: ordinal[1] ?? null,
      scheme: 'turkish-ordinal',
    }
  }

  const letter = LETTER.exec(line)
  if (letter) {
    return { text: letter[2] ?? '', level: 2, numbering: `${letter[1]})`, scheme: 'letter' }
  }

  if (isBareCapsHeading(line)) {
    return { text: line.trim(), level: 1, numbering: null, scheme: 'none' }
  }

  return undefined
}

/** Belge genelinde baskın şemayı seçer; eşitlikte/karışıklıkta `mixed`. */
function dominantScheme(headings: readonly HeadingInfo[]): NumberingScheme {
  const withNumbering = headings.filter((heading) => heading.scheme !== 'none')
  if (withNumbering.length === 0) return headings.length > 0 ? 'none' : 'none'

  const counts = new Map<NumberingScheme, number>()
  for (const heading of withNumbering) {
    counts.set(heading.scheme, (counts.get(heading.scheme) ?? 0) + 1)
  }
  const distinctSchemes = [...counts.keys()]
  if (distinctSchemes.length === 1) return distinctSchemes[0] as NumberingScheme
  return 'mixed'
}

export function extractStructure(document: string): DocumentStructure {
  const lines = document.split('\n')
  const headings: HeadingInfo[] = []
  let offset = 0

  for (const line of lines) {
    const detected = detectHeading(line)
    if (detected) headings.push({ ...detected, start: offset })
    offset += line.length + 1 // '\n' geri eklenir
  }

  return {
    headings,
    sectionOrder: headings.map((heading) => heading.text),
    numberingScheme: dominantScheme(headings),
  }
}
