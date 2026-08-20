/**
 * Yapı/iskelet çıkarma — plan M8.2, `docs/CAPABILITIES.md` A8.
 *
 * Tamamen deterministiktir, model kullanmaz: eski bir dilekçeden başlık
 * düzenini, numaralandırma şemasını ve bölüm sırasını satır deseniyle çıkarır.
 * Üslup profiline (M8.3) ve bölüm bölüm üretime (M8.7) girdi verir.
 */

export type NumberingScheme = 'roman' | 'arabic' | 'lettered' | 'mixed' | 'none'

export interface SkeletonSection {
  readonly heading: string
  /** 0 = en üst seviye (ör. "GEREKÇE"), 1 = alt madde (ör. "1.1.") */
  readonly level: number
  /** Başlığın numaralandırma öneki — yoksa `undefined` (ör. sabit üst başlıklar). */
  readonly numbering?: string
  readonly lineIndex: number
}

export interface DocumentSkeleton {
  readonly sections: readonly SkeletonSection[]
  readonly numberingScheme: NumberingScheme
}

const ROMAN = /^(?<num>[IVXLCDM]+)\.\s+(?<rest>.+)$/
const ARABIC = /^(?<num>\d+(?:\.\d+)*)\.\s+(?<rest>.+)$/
const LETTERED = /^(?<num>[A-ZÇĞİÖŞÜa-zçğıöşü])[).]\s+(?<rest>.+)$/
/** "SONUÇ VE İSTEM", "OLAYLAR" gibi numarasız üst başlıklar. */
const ALL_CAPS = /^[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ0-9\s.:,-]{1,79}$/

type NumberedScheme = Exclude<NumberingScheme, 'mixed' | 'none'>

interface HeadingMatch {
  readonly numbering?: string
  readonly heading: string
  /** ALL_CAPS başlıklar numarasızdır — şema çoğunluğuna katkı yapmaz. */
  readonly scheme?: NumberedScheme
}

function matchHeading(line: string): HeadingMatch | undefined {
  const trimmed = line.trim()
  if (trimmed.length === 0) return undefined

  const roman = ROMAN.exec(trimmed)
  if (roman?.groups?.num !== undefined && roman.groups.rest !== undefined) {
    return { numbering: roman.groups.num, heading: roman.groups.rest, scheme: 'roman' }
  }

  const arabic = ARABIC.exec(trimmed)
  if (arabic?.groups?.num !== undefined && arabic.groups.rest !== undefined) {
    return { numbering: arabic.groups.num, heading: arabic.groups.rest, scheme: 'arabic' }
  }

  const lettered = LETTERED.exec(trimmed)
  if (lettered?.groups?.num !== undefined && lettered.groups.rest !== undefined) {
    return { numbering: lettered.groups.num, heading: lettered.groups.rest, scheme: 'lettered' }
  }

  if (ALL_CAPS.test(trimmed)) {
    return { heading: trimmed }
  }

  return undefined
}

/** Numaralandırmadaki nokta sayısı seviyeyi verir: "1." → 0, "1.1." → 1. */
function levelOf(numbering: string | undefined, scheme: NumberedScheme | undefined): number {
  if (!numbering || scheme !== 'arabic') return 0
  return numbering.split('.').length - 1
}

function dominantScheme(schemes: readonly NumberedScheme[]): NumberingScheme {
  if (schemes.length === 0) return 'none'
  const counts = new Map<string, number>()
  for (const scheme of schemes) counts.set(scheme, (counts.get(scheme) ?? 0) + 1)
  const distinct = [...counts.keys()]
  if (distinct.length === 1) return distinct[0] as NumberingScheme
  return 'mixed'
}

export function extractSkeleton(text: string): DocumentSkeleton {
  const lines = text.split('\n')
  const sections: SkeletonSection[] = []
  const schemes: NumberedScheme[] = []

  lines.forEach((line, lineIndex) => {
    const match = matchHeading(line)
    if (!match) return

    if (match.scheme) schemes.push(match.scheme)
    sections.push({
      heading: match.heading,
      level: levelOf(match.numbering, match.scheme),
      lineIndex,
      ...(match.numbering ? { numbering: match.numbering } : {}),
    })
  })

  return { sections, numberingScheme: dominantScheme(schemes) }
}
