/**
 * Üslup profili — plan M8.3, M8.4, `CAPABILITIES.md` A8.
 *
 * Profil belge belge, ARTIMLI üretilir: `addDocument` saf bir fonksiyondur,
 * ham metinleri hiçbir yerde biriktirmez — yalnız çalışan istatistikleri
 * (ortalama, sayaç) ve sınırlı sayıda temsilî örneği günceller. Böylece N
 * belgenin aynı anda bellekte olması gerekmez (A8: "Profil, N belgenin aynı
 * anda bağlamda olmasını gerektirmez").
 */

import { extractSkeleton, type NumberingStyle } from './skeleton'

export interface LengthDistribution {
  readonly count: number
  readonly mean: number
  readonly min: number
  readonly max: number
}

export interface SampleParagraph {
  readonly documentId: string
  readonly text: string
}

export interface StyleProfile {
  readonly documentCount: number
  /** Cümle uzunluğu, kelime sayısı olarak. */
  readonly sentenceLength: LengthDistribution
  /** Paragraf uzunluğu, cümle sayısı olarak. */
  readonly paragraphLength: LengthDistribution
  readonly numberingStyle: NumberingStyle
  /** Kalıp ifade → kaç belgede geçtiği. */
  readonly boilerplatePhrases: Readonly<Record<string, number>>
  /** Hukuki terim tercihi → toplam geçiş sayısı. */
  readonly termPreferences: Readonly<Record<string, number>>
  /** Atıf biçimi örnekleri (`6100 sayılı HMK m. 119` gibi), en yeni `MAX_SAMPLES` tanesi. */
  readonly citationSamples: readonly string[]
  /** Hitap biçimi örnekleri (belgenin ilk satırı). */
  readonly salutationSamples: readonly string[]
  /** Kapanış biçimi örnekleri (belgenin son satırı). */
  readonly closingSamples: readonly string[]
  /** A8: her belgeden 2–3 temsilî paragraf. */
  readonly sampleParagraphs: readonly SampleParagraph[]
}

const MAX_SAMPLES = 40
const SAMPLES_PER_DOCUMENT = 3

/** Sözleşme kararlılığı (M13.5) beklenmeden değişebilir; yaygın hukuki kalıp ifadeler. */
const KNOWN_BOILERPLATE_PHRASES: readonly string[] = [
  'yukarıda arz ve izah edilen nedenlerle',
  'yukarıda açıklanan nedenlerle',
  'sayın mahkemenizce',
  'saygılarımla arz ve talep ederim',
  'saygılarımla arz ederim',
  'davanın kabulüne karar verilmesini',
  'fazlaya ilişkin haklarımız saklı kalmak kaydıyla',
  'işbu dava açma zarureti hasıl olmuştur',
  'yasal süresi içerisinde',
  'karar verilmesini saygıyla arz ve talep ederim',
]

const KNOWN_TERM_PREFERENCES: readonly string[] = [
  'davacı',
  'davalı',
  'müvekkil',
  'müekkil',
  'iddia',
  'savunma',
  'istinaf',
  'temyiz',
  'esas',
  'karar',
  'ıslah',
  'tebligat',
  'vekâlet',
  'vekalet',
]

const CITATION_PATTERN = /\d{2,5}\s+sayılı\s+[\p{L}][\p{L}.\s]{0,40}?(?:m\.|madde)\s*\d+/giu

function emptyDistribution(): LengthDistribution {
  return { count: 0, mean: 0, min: Infinity, max: -Infinity }
}

/** Çalışan ortalama (Welford) — ham değerleri saklamadan birleştirir. */
function foldDistribution(dist: LengthDistribution, values: readonly number[]): LengthDistribution {
  let { count, mean, min, max } = dist
  for (const value of values) {
    count += 1
    mean += (value - mean) / count
    min = Math.min(min, value)
    max = Math.max(max, value)
  }
  return { count, mean, min, max }
}

export function emptyStyleProfile(): StyleProfile {
  return {
    documentCount: 0,
    sentenceLength: emptyDistribution(),
    paragraphLength: emptyDistribution(),
    numberingStyle: 'none',
    boilerplatePhrases: {},
    termPreferences: {},
    citationSamples: [],
    salutationSamples: [],
    closingSamples: [],
    sampleParagraphs: [],
  }
}

function splitParagraphs(text: string): readonly string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
}

function splitSentences(text: string): readonly string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[\p{Lu}0-9])/gu)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
}

function wordCount(text: string): number {
  return (text.match(/\p{L}+/gu) ?? []).length
}

function countOccurrences(haystackLower: string, needle: string): number {
  let count = 0
  let index = haystackLower.indexOf(needle)
  while (index !== -1) {
    count += 1
    index = haystackLower.indexOf(needle, index + needle.length)
  }
  return count
}

/** En yeni öğeleri tutar, `cap` aşılınca en eskiyi düşürür (sınırsız büyümeyi önler). */
function pushCapped<T>(existing: readonly T[], items: readonly T[], cap: number): readonly T[] {
  const combined = [...existing, ...items]
  return combined.length > cap ? combined.slice(combined.length - cap) : combined
}

function mergeCounts(
  existing: Readonly<Record<string, number>>,
  additions: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> {
  const merged: Record<string, number> = { ...existing }
  for (const [key, value] of Object.entries(additions)) {
    merged[key] = (merged[key] ?? 0) + value
  }
  return merged
}

/**
 * Tek bir belgeyi profile katar (M8.4 — artımlı, birleştirilebilir). Ham
 * metin profilde saklanmaz; yalnız istatistikler ve sınırlı örnekler kalır.
 */
export function addDocument(
  profile: StyleProfile,
  documentId: string,
  documentText: string,
): StyleProfile {
  const paragraphs = splitParagraphs(documentText)
  const sentences = paragraphs.flatMap((paragraph) => splitSentences(paragraph))

  const sentenceLength = foldDistribution(
    profile.sentenceLength,
    sentences.map((sentence) => wordCount(sentence)),
  )
  const paragraphLength = foldDistribution(
    profile.paragraphLength,
    paragraphs.map((paragraph) => splitSentences(paragraph).length),
  )

  const lower = documentText.toLocaleLowerCase('tr')
  // Kalıp ifadeler kağıt üzerinde satır sonlarına bölünebilir; karşılaştırma
  // için boşluk dizilerini teke indirip satır kaymalarını görmezden geliyoruz.
  const normalizedLower = lower.replace(/\s+/g, ' ')

  const boilerplateHits: Record<string, number> = {}
  for (const phrase of KNOWN_BOILERPLATE_PHRASES) {
    const hits = countOccurrences(normalizedLower, phrase)
    if (hits > 0) boilerplateHits[phrase] = hits
  }

  const termHits: Record<string, number> = {}
  for (const term of KNOWN_TERM_PREFERENCES) {
    const hits = countOccurrences(lower, term)
    if (hits > 0) termHits[term] = hits
  }

  const citations = [...documentText.matchAll(CITATION_PATTERN)].map((match) => match[0])

  const lines = documentText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  const salutation = lines[0]
  const closing = lines[lines.length - 1]

  const representativeParagraphs = pickRepresentativeParagraphs(paragraphs, SAMPLES_PER_DOCUMENT).map(
    (text): SampleParagraph => ({ documentId, text }),
  )

  const skeleton = extractSkeleton(documentText)

  return {
    documentCount: profile.documentCount + 1,
    sentenceLength,
    paragraphLength,
    numberingStyle:
      skeleton.numberingStyle === 'none' ? profile.numberingStyle : skeleton.numberingStyle,
    boilerplatePhrases: mergeCounts(profile.boilerplatePhrases, boilerplateHits),
    termPreferences: mergeCounts(profile.termPreferences, termHits),
    citationSamples: pushCapped(profile.citationSamples, citations, MAX_SAMPLES),
    salutationSamples: salutation ? pushCapped(profile.salutationSamples, [salutation], MAX_SAMPLES) : profile.salutationSamples,
    closingSamples: closing ? pushCapped(profile.closingSamples, [closing], MAX_SAMPLES) : profile.closingSamples,
    sampleParagraphs: pushCapped(profile.sampleParagraphs, representativeParagraphs, MAX_SAMPLES),
  }
}

/** En uzun `count` paragrafı seçer — kısa ("SAYGILARIMLA" gibi tek satır) paragraflar temsilî değildir. */
function pickRepresentativeParagraphs(
  paragraphs: readonly string[],
  count: number,
): readonly string[] {
  return [...paragraphs]
    .sort((a, b) => b.length - a.length)
    .slice(0, count)
}
