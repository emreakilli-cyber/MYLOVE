/**
 * Üslup profili — plan M8.3 / M8.4.
 *
 * `CAPABILITIES.md` A8: cümle/paragraf uzunluğu, kalıp ifadeler, hitap/kapanış
 * biçimi, atıf biçimi, terim tercihleri. Profil **artımlı** üretilir — belge
 * belge çıkarılır, `mergeStyleProfiles` ile birleştirilir. Bunun için sayısal
 * dağılımlar özet istatistik olarak değil, **yeterli istatistik** (toplam,
 * kareler toplamı, sayaç) olarak tutulur: iki profilin ortalama/std sapması
 * ham metne dönmeden doğru biçimde birleştirilebilir.
 *
 * Histogram kovaları SABİTTİR (veri bağımlı değil) — böylece iki profilin
 * kovaları eleman eleman toplanabilir; farklı kova sınırlarıyla üretilmiş iki
 * histogram birleştirilemezdi.
 *
 * Tamamen deterministiktir; model kullanmaz.
 */

import { extractStructure } from './structure'

const WORD_BUCKET_EDGES = [0, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, Infinity] as const
const SENTENCE_BUCKET_EDGES = [0, 1, 2, 3, 5, 8, 12, 18, 25, Infinity] as const

export interface Histogram {
  readonly bucketEdges: readonly number[]
  readonly buckets: readonly number[]
}

export interface NumericDistribution {
  readonly count: number
  readonly sum: number
  readonly sumOfSquares: number
  readonly mean: number
  readonly stdev: number
  readonly histogram: Histogram
}

export interface PhraseFrequency {
  readonly phrase: string
  readonly count: number
}

export interface StyleProfile {
  readonly documentCount: number
  /** Cümle uzunluğu, sözcük cinsinden. */
  readonly sentenceLength: NumericDistribution
  /** Paragraf uzunluğu, cümle cinsinden. */
  readonly paragraphLength: NumericDistribution
  readonly stockPhrases: readonly PhraseFrequency[]
  readonly numberingStyle: Readonly<Record<string, number>>
  readonly greetings: readonly PhraseFrequency[]
  readonly closings: readonly PhraseFrequency[]
  readonly citationPatterns: readonly PhraseFrequency[]
  readonly preferredTerms: readonly PhraseFrequency[]
}

function emptyHistogram(edges: readonly number[]): Histogram {
  return { bucketEdges: edges, buckets: new Array(edges.length - 1).fill(0) }
}

function bucketIndex(edges: readonly number[], value: number): number {
  for (let index = 0; index < edges.length - 1; index++) {
    const lower = edges[index] as number
    const upper = edges[index + 1] as number
    if (value >= lower && value < upper) return index
  }
  return edges.length - 2
}

function addToHistogram(histogram: Histogram, value: number): Histogram {
  const index = bucketIndex(histogram.bucketEdges, value)
  const buckets = histogram.buckets.slice()
  buckets[index] = (buckets[index] ?? 0) + 1
  return { bucketEdges: histogram.bucketEdges, buckets }
}

function mergeHistograms(a: Histogram, b: Histogram): Histogram {
  if (a.bucketEdges.length !== b.bucketEdges.length) {
    throw new Error('Farklı kova sınırlarına sahip histogramlar birleştirilemez')
  }
  return {
    bucketEdges: a.bucketEdges,
    buckets: a.buckets.map((count, index) => count + (b.buckets[index] ?? 0)),
  }
}

function distributionFromValues(values: readonly number[], edges: readonly number[]): NumericDistribution {
  let histogram = emptyHistogram(edges)
  let sum = 0
  let sumOfSquares = 0
  for (const value of values) {
    sum += value
    sumOfSquares += value * value
    histogram = addToHistogram(histogram, value)
  }
  const count = values.length
  const mean = count === 0 ? 0 : sum / count
  const variance = count === 0 ? 0 : Math.max(0, sumOfSquares / count - mean * mean)
  return { count, sum, sumOfSquares, mean, stdev: Math.sqrt(variance), histogram }
}

function mergeDistributions(a: NumericDistribution, b: NumericDistribution): NumericDistribution {
  const count = a.count + b.count
  const sum = a.sum + b.sum
  const sumOfSquares = a.sumOfSquares + b.sumOfSquares
  const mean = count === 0 ? 0 : sum / count
  const variance = count === 0 ? 0 : Math.max(0, sumOfSquares / count - mean * mean)
  return {
    count,
    sum,
    sumOfSquares,
    mean,
    stdev: Math.sqrt(variance),
    histogram: mergeHistograms(a.histogram, b.histogram),
  }
}

function mergePhraseFrequencies(
  lists: readonly (readonly PhraseFrequency[])[],
  limit = 20,
): readonly PhraseFrequency[] {
  const totals = new Map<string, number>()
  for (const list of lists) {
    for (const { phrase, count } of list) {
      totals.set(phrase, (totals.get(phrase) ?? 0) + count)
    }
  }
  return [...totals.entries()]
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count || a.phrase.localeCompare(b.phrase, 'tr'))
    .slice(0, limit)
}

function mergeCounters(
  counters: readonly Readonly<Record<string, number>>[],
): Readonly<Record<string, number>> {
  const result: Record<string, number> = {}
  for (const counter of counters) {
    for (const [key, value] of Object.entries(counter)) {
      result[key] = (result[key] ?? 0) + value
    }
  }
  return result
}

/** Kalıp ifadeler — hukuk dilekçelerinde sık geçen sabit kalıplar (genişletilebilir liste). */
const STOCK_PHRASES = [
  'yukarıda arz ve izah edilen nedenlerle',
  'yukarıda açıklanan nedenlerle',
  'bilcümle yasal haklarım saklı kalmak kaydıyla',
  'netice-i talep',
  'arz ve talep ederim',
  'hukuka aykırıdır',
  'usul ve yasaya aykırıdır',
  'davanın kabulüne karar verilmesini',
  'yargılama giderleri ve vekalet ücretinin karşı tarafa yükletilmesine',
  'fazlaya ilişkin haklarımız saklı kalmak kaydıyla',
]

const GREETINGS = [
  "sayın hakimliğine",
  "nöbetçi asliye hukuk mahkemesi'ne",
  "mahkemesi'ne",
  'sayın mahkemeye',
]

const CLOSINGS = ['saygılarımla arz ve talep ederim', 'saygılarımla arz ederim', 'saygılarımla']

const CITATION_PATTERN = /\b(TBK|TMK|HMK|CMK|TCK|İİK|TTK)\s?(?:m\.|madde)\s?\d+/giu
const YARGITAY_CITATION_PATTERN = /Yargıtay\s+\d+\.\s?(?:HD|CD)\b/giu

/** Terim tercihi çiftleri — hangi eş anlamlının kullanıldığını izler. */
const TERM_PAIRS: readonly (readonly [string, string])[] = [
  ['davacı', 'müvekkil'],
  ['dilekçe', 'layiha'],
  ['fesih', 'sona erme'],
  ['tazminat', 'zarar bedeli'],
]

function countOccurrences(haystack: string, needle: string): number {
  const lower = haystack.toLocaleLowerCase('tr')
  const target = needle.toLocaleLowerCase('tr')
  if (target.length === 0) return 0
  let count = 0
  let index = lower.indexOf(target)
  while (index !== -1) {
    count++
    index = lower.indexOf(target, index + target.length)
  }
  return count
}

function frequenciesFromDictionary(text: string, dictionary: readonly string[]): PhraseFrequency[] {
  return dictionary
    .map((phrase) => ({ phrase, count: countOccurrences(text, phrase) }))
    .filter((entry) => entry.count > 0)
}

function citationFrequencies(text: string): PhraseFrequency[] {
  const totals = new Map<string, number>()
  for (const pattern of [CITATION_PATTERN, YARGITAY_CITATION_PATTERN]) {
    for (const match of text.matchAll(pattern)) {
      const normalized = match[0].replace(/\s+/g, ' ').trim()
      totals.set(normalized, (totals.get(normalized) ?? 0) + 1)
    }
  }
  return [...totals.entries()].map(([phrase, count]) => ({ phrase, count }))
}

function preferredTermFrequencies(text: string): PhraseFrequency[] {
  const result: PhraseFrequency[] = []
  for (const [a, b] of TERM_PAIRS) {
    const countA = countOccurrences(text, a)
    const countB = countOccurrences(text, b)
    if (countA > 0) result.push({ phrase: a, count: countA })
    if (countB > 0) result.push({ phrase: b, count: countB })
  }
  return result
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[\p{Lu}"“])/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
}

function wordCount(sentence: string): number {
  const words = sentence.split(/\s+/).filter((word) => word.length > 0)
  return words.length
}

/** Tek bir belgeden üslup profili çıkarır (`documentCount: 1`). M8.3. */
export function extractStyleProfile(document: string): StyleProfile {
  const paragraphs = splitParagraphs(document)
  const sentences = paragraphs.flatMap(splitSentences)

  const sentenceLengths = sentences.map(wordCount)
  const paragraphLengths = paragraphs.map((paragraph) => splitSentences(paragraph).length)

  const numberingCounts: Record<string, number> = {}
  for (const heading of extractStructure(document).headings) {
    numberingCounts[heading.scheme] = (numberingCounts[heading.scheme] ?? 0) + 1
  }

  return {
    documentCount: 1,
    sentenceLength: distributionFromValues(sentenceLengths, WORD_BUCKET_EDGES),
    paragraphLength: distributionFromValues(paragraphLengths, SENTENCE_BUCKET_EDGES),
    stockPhrases: frequenciesFromDictionary(document, STOCK_PHRASES),
    numberingStyle: numberingCounts,
    greetings: frequenciesFromDictionary(document, GREETINGS),
    closings: frequenciesFromDictionary(document, CLOSINGS),
    citationPatterns: citationFrequencies(document),
    preferredTerms: preferredTermFrequencies(document),
  }
}

/** Boş profil — birleştirmede başlangıç değeri. */
export function emptyStyleProfile(): StyleProfile {
  return {
    documentCount: 0,
    sentenceLength: distributionFromValues([], WORD_BUCKET_EDGES),
    paragraphLength: distributionFromValues([], SENTENCE_BUCKET_EDGES),
    stockPhrases: [],
    numberingStyle: {},
    greetings: [],
    closings: [],
    citationPatterns: [],
    preferredTerms: [],
  }
}

/**
 * İki ya da daha çok profili birleştirir (M8.4 — artımlı toplama). Belgeler
 * hiçbir zaman aynı anda bağlamda olmak zorunda değildir; her biri tek tek
 * işlenip profile eklenir.
 */
export function mergeStyleProfiles(profiles: readonly StyleProfile[]): StyleProfile {
  if (profiles.length === 0) return emptyStyleProfile()

  return profiles.reduce((acc, profile) => ({
    documentCount: acc.documentCount + profile.documentCount,
    sentenceLength: mergeDistributions(acc.sentenceLength, profile.sentenceLength),
    paragraphLength: mergeDistributions(acc.paragraphLength, profile.paragraphLength),
    stockPhrases: mergePhraseFrequencies([acc.stockPhrases, profile.stockPhrases]),
    numberingStyle: mergeCounters([acc.numberingStyle, profile.numberingStyle]),
    greetings: mergePhraseFrequencies([acc.greetings, profile.greetings]),
    closings: mergePhraseFrequencies([acc.closings, profile.closings]),
    citationPatterns: mergePhraseFrequencies([acc.citationPatterns, profile.citationPatterns]),
    preferredTerms: mergePhraseFrequencies([acc.preferredTerms, profile.preferredTerms]),
  }))
}
