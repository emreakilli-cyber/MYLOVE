/**
 * Üslup profili — plan M8.3 / M8.4, `CAPABILITIES.md` A8 (b).
 *
 * `StyleProfile` doğrudan JSON'a yazılabilir bir düz veri yapısıdır — M8.3'ün
 * istediği "JSON şeması" budur, ayrı bir doküman değil. `extractStyleFeatures`
 * tek bir belgeden (`documentCount: 1`) profil çıkarır, `mergeStyleProfiles`
 * iki profili birleştirir. Böylece "belge belge, birikimli" üretim (A8, M8.4)
 * doğal bir kıvrımdır: N belge = N kez çıkar + (N-1) kez birleştir; hiçbir
 * belge diğerleriyle aynı anda bellekte olmak zorunda değildir.
 *
 * Bütçe notu (A8: "birkaç KB'lık tek profil"): sayaçlar (`count`/`sum`/`max`)
 * ve ifade frekansları corpus büyüklüğünden BAĞIMSIZ sabit boyutta kalır.
 * Yalnız medyan yaklaşıklığı için tutulan örnek havuzları (`sampleReservoir`,
 * `sampleParagraphs`) sınırlıdır — bkz. `MAX_LENGTH_SAMPLES`,
 * `MAX_SAMPLE_PARAGRAPHS`. Sınırın ötesi sessizce büyümez, deterministik
 * biçimde eşit aralıklı örneklenir.
 */

import { extractSkeleton, type NumberingStyle } from './skeleton'

/** Medyan yaklaşıklığı için tutulan örnek sayısı üst sınırı. */
const MAX_LENGTH_SAMPLES = 64
/** Few-shot havuzu için tutulan temsilî paragraf sayısı üst sınırı. */
const MAX_SAMPLE_PARAGRAPHS = 30
/** A8: "her belgeden 2-3 temsilî paragraf örneklenir." */
const SAMPLE_PARAGRAPHS_PER_DOCUMENT = 3

export interface LengthAggregate {
  readonly count: number
  readonly sum: number
  readonly max: number
  /** Sınırlı, eşit aralıklı örnek havuzu — medyan bundan hesaplanır. */
  readonly sampleReservoir: readonly number[]
}

export function aggregateMean(aggregate: LengthAggregate): number {
  return aggregate.count === 0 ? 0 : aggregate.sum / aggregate.count
}

export function aggregateMedian(aggregate: LengthAggregate): number {
  const sorted = [...aggregate.sampleReservoir].sort((a, b) => a - b)
  if (sorted.length === 0) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

function downsample(values: readonly number[], limit: number): readonly number[] {
  if (values.length <= limit) return values
  const sorted = [...values].sort((a, b) => a - b)
  const step = sorted.length / limit
  const picked: number[] = []
  for (let i = 0; i < limit; i++) {
    picked.push(sorted[Math.min(sorted.length - 1, Math.floor(i * step))]!)
  }
  return picked
}

function toAggregate(values: readonly number[]): LengthAggregate {
  return {
    count: values.length,
    sum: values.reduce((a, b) => a + b, 0),
    max: values.reduce((a, b) => Math.max(a, b), 0),
    sampleReservoir: downsample(values, MAX_LENGTH_SAMPLES),
  }
}

function mergeLengthAggregate(a: LengthAggregate, b: LengthAggregate): LengthAggregate {
  return {
    count: a.count + b.count,
    sum: a.sum + b.sum,
    max: Math.max(a.max, b.max),
    sampleReservoir: downsample([...a.sampleReservoir, ...b.sampleReservoir], MAX_LENGTH_SAMPLES),
  }
}

function emptyAggregate(): LengthAggregate {
  return { count: 0, sum: 0, max: 0, sampleReservoir: [] }
}

export interface PhraseFrequency {
  readonly phrase: string
  readonly count: number
}

function countPhrases(document: string, candidates: readonly string[]): readonly PhraseFrequency[] {
  const lower = document.toLocaleLowerCase('tr')
  const found: PhraseFrequency[] = []
  for (const phrase of candidates) {
    const needle = phrase.toLocaleLowerCase('tr')
    let count = 0
    let from = 0
    for (;;) {
      const index = lower.indexOf(needle, from)
      if (index === -1) break
      count++
      from = index + needle.length
    }
    if (count > 0) found.push({ phrase, count })
  }
  return found
}

function mergePhraseFrequencies(
  a: readonly PhraseFrequency[],
  b: readonly PhraseFrequency[],
): readonly PhraseFrequency[] {
  const counts = new Map<string, number>()
  for (const { phrase, count } of [...a, ...b]) {
    counts.set(phrase, (counts.get(phrase) ?? 0) + count)
  }
  return [...counts.entries()]
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((x, y) => y.count - x.count || x.phrase.localeCompare(y.phrase, 'tr'))
}

/** Türkçe dilekçelerde sık geçen kalıp ifadeler — "kalıp ifadeler" (M8.3). */
const STOCK_PHRASES: readonly string[] = [
  'yukarıda arz ve izah edilen nedenlerle',
  'yukarıda açıklanan nedenlerle',
  'sayın mahkemenizce',
  'arz ve talep ederim',
  'yasal süresi içinde',
  'fazlaya ilişkin haklarımız saklı kalmak kaydıyla',
  'netice-i talep',
]

/** Kapanış kalıpları — "hitap/kapanış biçimi" (M8.3). */
const CLOSING_PHRASES: readonly string[] = [
  'saygılarımla arz ederim',
  'saygılarımla',
  'arz ederim',
  'bilgilerinize sunarım',
]

/** Terim tercihleri — "terim tercihleri" (M8.3). */
const TERM_CANDIDATES: readonly string[] = [
  'davacı',
  'davalı',
  'müvekkil',
  'karşı taraf',
  'ihtarname',
  'ihbarname',
  'fesih',
  'tazminat',
  'vekâlet ücreti',
  'yargılama gideri',
  'esas no',
  'karar no',
]

const SALUTATION_LINE = /^(SAYIN\s+.+|.+MAHKEMESİ['’]?NE)\s*$/u
const CITATION = /Yargıtay\s+\d+\.\s*(?:H\.?D\.?|Hukuk Dairesi|CD|Ceza Dairesi)[^\n,]{0,40},?\s*E\.?\s*\d{4}\/\d+[^\n]{0,20}K\.?\s*\d{4}\/\d+/giu

function extractSalutations(document: string): readonly PhraseFrequency[] {
  const lines = document.split(/\r?\n/).map((line) => line.trim())
  const matches = lines.filter((line) => line.length > 0 && SALUTATION_LINE.test(line))
  return mergePhraseFrequencies(
    matches.map((phrase) => ({ phrase, count: 1 })),
    [],
  )
}

/** Atıf biçimini SAYIYA değil ŞEKLE indirger: `Yargıtay 3. HD, E. 2024/1, K. 2024/2` -> `... #, ... #/#, ... #/#`. */
function citationShape(raw: string): string {
  return raw.replace(/\d+/g, '#')
}

function extractCitationPatterns(document: string): readonly PhraseFrequency[] {
  const matches = [...document.matchAll(CITATION)].map((match) => citationShape(match[0]))
  return mergePhraseFrequencies(
    matches.map((phrase) => ({ phrase, count: 1 })),
    [],
  )
}

function splitParagraphs(document: string): readonly string[] {
  return document
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}

/** Cümle sonu: nokta/ünlem/soru işareti + boşluk + büyük harf/rakam ile devam. */
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ0-9])/u

function splitSentences(paragraph: string): readonly string[] {
  return paragraph
    .split(SENTENCE_BOUNDARY)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function pickRepresentativeParagraphs(paragraphs: readonly string[], count: number): readonly string[] {
  return [...paragraphs]
    .map((text, index) => ({ text, index, words: text.split(/\s+/).filter(Boolean).length }))
    .sort((a, b) => b.words - a.words || a.index - b.index)
    .slice(0, count)
    .sort((a, b) => a.index - b.index)
    .map((p) => p.text)
}

function capSampleParagraphs(paragraphs: readonly string[]): readonly string[] {
  if (paragraphs.length <= MAX_SAMPLE_PARAGRAPHS) return paragraphs
  const step = paragraphs.length / MAX_SAMPLE_PARAGRAPHS
  const picked: string[] = []
  for (let i = 0; i < MAX_SAMPLE_PARAGRAPHS; i++) {
    picked.push(paragraphs[Math.min(paragraphs.length - 1, Math.floor(i * step))]!)
  }
  return picked
}

export interface StyleProfile {
  readonly documentCount: number
  readonly sentenceWordCounts: LengthAggregate
  readonly paragraphSentenceCounts: LengthAggregate
  readonly stockPhrases: readonly PhraseFrequency[]
  readonly numberingStyleCounts: Readonly<Partial<Record<NumberingStyle, number>>>
  readonly salutations: readonly PhraseFrequency[]
  readonly closings: readonly PhraseFrequency[]
  readonly citationPatterns: readonly PhraseFrequency[]
  readonly preferredTerms: readonly PhraseFrequency[]
  /** Few-shot havuzunun kaynağı (M8.5) — belge başına en uzun ≤3 paragraf. */
  readonly sampleParagraphs: readonly string[]
}

export function emptyStyleProfile(): StyleProfile {
  return {
    documentCount: 0,
    sentenceWordCounts: emptyAggregate(),
    paragraphSentenceCounts: emptyAggregate(),
    stockPhrases: [],
    numberingStyleCounts: {},
    salutations: [],
    closings: [],
    citationPatterns: [],
    preferredTerms: [],
    sampleParagraphs: [],
  }
}

/** Tek bir dilekçeden üslup öznitelikleri çıkarır (`documentCount: 1`). */
export function extractStyleFeatures(document: string): StyleProfile {
  const paragraphs = splitParagraphs(document)
  const sentenceWordCounts: number[] = []
  const paragraphSentenceCounts: number[] = []

  for (const paragraph of paragraphs) {
    const sentences = splitSentences(paragraph)
    paragraphSentenceCounts.push(sentences.length)
    for (const sentence of sentences) {
      const words = sentence.split(/\s+/).filter(Boolean).length
      if (words > 0) sentenceWordCounts.push(words)
    }
  }

  const skeleton = extractSkeleton(document)
  const numberingStyleCounts: Partial<Record<NumberingStyle, number>> = {}
  for (const section of skeleton.sections) {
    if (section.numberingStyle === 'none') continue
    numberingStyleCounts[section.numberingStyle] = (numberingStyleCounts[section.numberingStyle] ?? 0) + 1
  }

  return {
    documentCount: 1,
    sentenceWordCounts: toAggregate(sentenceWordCounts),
    paragraphSentenceCounts: toAggregate(paragraphSentenceCounts),
    stockPhrases: countPhrases(document, STOCK_PHRASES),
    numberingStyleCounts,
    salutations: extractSalutations(document),
    closings: countPhrases(document, CLOSING_PHRASES),
    citationPatterns: extractCitationPatterns(document),
    preferredTerms: countPhrases(document, TERM_CANDIDATES),
    sampleParagraphs: pickRepresentativeParagraphs(paragraphs, SAMPLE_PARAGRAPHS_PER_DOCUMENT),
  }
}

function mergeNumberingCounts(
  a: Readonly<Partial<Record<NumberingStyle, number>>>,
  b: Readonly<Partial<Record<NumberingStyle, number>>>,
): Readonly<Partial<Record<NumberingStyle, number>>> {
  const merged: Partial<Record<NumberingStyle, number>> = { ...a }
  for (const key of Object.keys(b) as NumberingStyle[]) {
    merged[key] = (merged[key] ?? 0) + (b[key] ?? 0)
  }
  return merged
}

/**
 * İki profili birleştirir — sıra fark etmez (bkz. `style.test.ts`daki
 * değişmezlik testi). A8/M8.4'ün "artımlı, belge belge birleştirilebilir"
 * gereksinimi budur.
 */
export function mergeStyleProfiles(a: StyleProfile, b: StyleProfile): StyleProfile {
  return {
    documentCount: a.documentCount + b.documentCount,
    sentenceWordCounts: mergeLengthAggregate(a.sentenceWordCounts, b.sentenceWordCounts),
    paragraphSentenceCounts: mergeLengthAggregate(a.paragraphSentenceCounts, b.paragraphSentenceCounts),
    stockPhrases: mergePhraseFrequencies(a.stockPhrases, b.stockPhrases),
    numberingStyleCounts: mergeNumberingCounts(a.numberingStyleCounts, b.numberingStyleCounts),
    salutations: mergePhraseFrequencies(a.salutations, b.salutations),
    closings: mergePhraseFrequencies(a.closings, b.closings),
    citationPatterns: mergePhraseFrequencies(a.citationPatterns, b.citationPatterns),
    preferredTerms: mergePhraseFrequencies(a.preferredTerms, b.preferredTerms),
    sampleParagraphs: capSampleParagraphs([...a.sampleParagraphs, ...b.sampleParagraphs]),
  }
}

/**
 * Kolaylık sarmalayıcı: belge listesinden tek profil kurar (çıkar + birleştir
 * döngüsü). Belgeler AYNI ANDA bellekte olmak zorunda değildir — çağıran
 * taraf bunu tek tek, oturumlara yayarak da yapabilir; sonuç aynıdır.
 */
export function buildStyleProfile(documents: readonly string[]): StyleProfile {
  return documents.reduce<StyleProfile>(
    (profile, document) => mergeStyleProfiles(profile, extractStyleFeatures(document)),
    emptyStyleProfile(),
  )
}
