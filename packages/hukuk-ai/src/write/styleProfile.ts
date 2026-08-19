/**
 * Üslup profili — plan M8.3 / M8.4, `CAPABILITIES.md` A8.
 *
 * Tasarım kararı: her alan bir HİSTOGRAM ya da bir FREKANS HARİTASIDIR, ham
 * örnek listesi değil. Sebep, A8'in birinci şartı — "profil artımlı üretilir,
 * belge belge birleştirilebilir" (M8.4). Histogram/frekans toplamsaldır:
 * `mergeStyleProfiles(a, b)` yalnız karşılık gelen sayaçları toplar; hiçbir
 * belgenin tam metnini bir sonraki belgenin işlenmesi için saklamaya gerek
 * yoktur. Bu da "ham kişisel veri diske yazılmaz" ilkesiyle uyumludur — profil
 * istatistik taşır, alıntı değil.
 *
 * Kalıp ifadeler (`stockPhrases`) sabit bir sözlükten DEĞİL, belgenin kendi
 * tekrarından çıkarılır (4 kelimelik n-gram, belge içinde ≥ 2 tekrar). Açılış/
 * kapanış (`openingPhrases`/`closingPhrases`) ise belgeler ARASI tekrardan
 * çıkarılır: her belgenin ilk ve son cümlesi normalize edilip sayılır — aynı
 * cümleyle çok belge açılıyorsa/kapanıyorsa bu, avukatın alışkanlığıdır.
 */

import type { NumberingStyle } from './structure'

export type FrequencyMap = Readonly<Record<string, number>>

export type LengthBucket = '1-10' | '11-20' | '21-30' | '31-50' | '51+'

const BUCKET_BOUNDS: readonly (readonly [number, LengthBucket])[] = [
  [10, '1-10'],
  [20, '11-20'],
  [30, '21-30'],
  [50, '31-50'],
  [Number.POSITIVE_INFINITY, '51+'],
]

function bucketFor(length: number): LengthBucket {
  for (const [bound, bucket] of BUCKET_BOUNDS) if (length <= bound) return bucket
  return '51+'
}

const EMPTY_BUCKETS: Readonly<Record<LengthBucket, number>> = {
  '1-10': 0,
  '11-20': 0,
  '21-30': 0,
  '31-50': 0,
  '51+': 0,
}

export interface LengthHistogram {
  readonly count: number
  readonly buckets: Readonly<Record<LengthBucket, number>>
}

function emptyHistogram(): LengthHistogram {
  return { count: 0, buckets: { ...EMPTY_BUCKETS } }
}

function histogramFromLengths(lengths: readonly number[]): LengthHistogram {
  const buckets: Record<LengthBucket, number> = { ...EMPTY_BUCKETS }
  for (const length of lengths) buckets[bucketFor(length)]++
  return { count: lengths.length, buckets }
}

function mergeHistograms(a: LengthHistogram, b: LengthHistogram): LengthHistogram {
  const buckets: Record<LengthBucket, number> = { ...EMPTY_BUCKETS }
  for (const bucket of Object.keys(buckets) as LengthBucket[]) {
    buckets[bucket] = a.buckets[bucket] + b.buckets[bucket]
  }
  return { count: a.count + b.count, buckets }
}

function mergeFrequencyMaps(a: FrequencyMap, b: FrequencyMap): FrequencyMap {
  const merged: Record<string, number> = { ...a }
  for (const [key, value] of Object.entries(b)) merged[key] = (merged[key] ?? 0) + value
  return merged
}

export interface StyleProfile {
  readonly documentCount: number
  /** Cümle uzunluğu, kelime sayısıyla ölçülür. */
  readonly sentenceLength: LengthHistogram
  /** Paragraf uzunluğu, içerdiği cümle sayısıyla ölçülür. */
  readonly paragraphLength: LengthHistogram
  readonly numberingStyle: FrequencyMap
  readonly openingPhrases: FrequencyMap
  readonly closingPhrases: FrequencyMap
  /** Atıf BİÇİMİ — hangi somut karar/madde değil, hangi kalıp kullanılıyor. */
  readonly citationPatterns: FrequencyMap
  readonly termPreferences: FrequencyMap
  readonly stockPhrases: FrequencyMap
}

export function emptyStyleProfile(): StyleProfile {
  return {
    documentCount: 0,
    sentenceLength: emptyHistogram(),
    paragraphLength: emptyHistogram(),
    numberingStyle: {},
    openingPhrases: {},
    closingPhrases: {},
    citationPatterns: {},
    termPreferences: {},
    stockPhrases: {},
  }
}

// SPEC dışı yaklaşık cümle ayırıcı: yaygın kısaltmalardan sonra bölmez.
const ABBREVIATIONS = ['Av', 'Dr', 'vs', 'Sn', 'Prof', 'Yrd', 'Doç', 'No', 'Mad', 'm']
const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ0-9])/

function splitSentences(paragraph: string): string[] {
  const raw = paragraph.split(SENTENCE_SPLIT).map((s) => s.trim()).filter(Boolean)
  const sentences: string[] = []
  for (const piece of raw) {
    const previous = sentences.at(-1)
    const lastWord = previous?.split(/\s+/).at(-1)?.replace(/\.$/, '')
    if (previous && lastWord && ABBREVIATIONS.includes(lastWord)) {
      sentences[sentences.length - 1] = `${previous} ${piece}`
    } else {
      sentences.push(piece)
    }
  }
  return sentences
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function wordCount(sentence: string): number {
  return sentence.split(/\s+/).filter(Boolean).length
}

function normalizeSentence(sentence: string): string {
  return sentence.toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim()
}

const CITATION_PATTERNS: readonly (readonly [string, RegExp])[] = [
  ['kanun_maddesi', /\b[A-ZÇĞİÖŞÜ]{2,6}\s*(?:m\.|madde)\s*\d+/gu],
  ['yargitay_dairesi', /Yargıtay\s+\d+\s*\.\s*(?:Hukuk|Ceza)\s*Dairesi/gu],
  ['esas_karar_no', /\d{4}\/\d+\s*(?:E\.|K\.)/gu],
]

// A8: "sık kullanılan terim seti". Bilinen eş anlamlı çift/gruplar arasında
// hangisinin tercih edildiğini sayar — üretim serbest metin doldururken bu
// tercihe uyulur.
const TERM_VARIANTS = [
  'davacı taraf',
  'müvekkilimiz',
  'bilvekale',
  'vekaleten',
  'yukarıda arz ve izah edilen nedenlerle',
  'yukarıda açıklanan nedenlerle',
  'sayın mahkemenize',
  'sayın hakimliğinize',
  'işbu dilekçemiz',
  'işbu dava dilekçemiz',
]

const STOCK_PHRASE_NGRAM = 4
const STOCK_PHRASE_MIN_REPEAT = 2

function extractStockPhrases(text: string): FrequencyMap {
  const words = text
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)

  const counts: Record<string, number> = {}
  for (let i = 0; i + STOCK_PHRASE_NGRAM <= words.length; i++) {
    const phrase = words.slice(i, i + STOCK_PHRASE_NGRAM).join(' ')
    counts[phrase] = (counts[phrase] ?? 0) + 1
  }

  const stock: Record<string, number> = {}
  for (const [phrase, count] of Object.entries(counts)) {
    if (count >= STOCK_PHRASE_MIN_REPEAT) stock[phrase] = count
  }
  return stock
}

function countCitationPatterns(text: string): FrequencyMap {
  const counts: Record<string, number> = {}
  for (const [name, pattern] of CITATION_PATTERNS) {
    const matches = text.match(pattern)
    if (matches && matches.length > 0) counts[name] = matches.length
  }
  return counts
}

function countTermPreferences(text: string): FrequencyMap {
  const lower = text.toLocaleLowerCase('tr-TR')
  const counts: Record<string, number> = {}
  for (const term of TERM_VARIANTS) {
    const occurrences = lower.split(term).length - 1
    if (occurrences > 0) counts[term] = occurrences
  }
  return counts
}

/** Tek belgeden istatistik profili çıkarır — diğer belgelerden bağımsız. */
export function buildStyleProfile(text: string, numberingStyle: NumberingStyle = 'none'): StyleProfile {
  const paragraphs = splitParagraphs(text)
  const sentencesByParagraph = paragraphs.map(splitSentences)
  const allSentences = sentencesByParagraph.flat()

  const firstSentence = allSentences.at(0)
  const lastSentence = allSentences.at(-1)

  return {
    documentCount: 1,
    sentenceLength: histogramFromLengths(allSentences.map(wordCount)),
    paragraphLength: histogramFromLengths(sentencesByParagraph.map((s) => s.length)),
    numberingStyle: numberingStyle === 'none' ? {} : { [numberingStyle]: 1 },
    openingPhrases: firstSentence ? { [normalizeSentence(firstSentence)]: 1 } : {},
    closingPhrases: lastSentence ? { [normalizeSentence(lastSentence)]: 1 } : {},
    citationPatterns: countCitationPatterns(text),
    termPreferences: countTermPreferences(text),
    stockPhrases: extractStockPhrases(text),
  }
}

/** M8.4 — iki profili birleştirir. Toplamsal; sıra önemsizdir (değişmeli). */
export function mergeStyleProfiles(a: StyleProfile, b: StyleProfile): StyleProfile {
  return {
    documentCount: a.documentCount + b.documentCount,
    sentenceLength: mergeHistograms(a.sentenceLength, b.sentenceLength),
    paragraphLength: mergeHistograms(a.paragraphLength, b.paragraphLength),
    numberingStyle: mergeFrequencyMaps(a.numberingStyle, b.numberingStyle),
    openingPhrases: mergeFrequencyMaps(a.openingPhrases, b.openingPhrases),
    closingPhrases: mergeFrequencyMaps(a.closingPhrases, b.closingPhrases),
    citationPatterns: mergeFrequencyMaps(a.citationPatterns, b.citationPatterns),
    termPreferences: mergeFrequencyMaps(a.termPreferences, b.termPreferences),
    stockPhrases: mergeFrequencyMaps(a.stockPhrases, b.stockPhrases),
  }
}

/** Birikimli toplama — belge belge, kaldığı yerden sürdürülebilir (A8). */
export function addDocumentToProfile(
  profile: StyleProfile,
  text: string,
  numberingStyle: NumberingStyle = 'none',
): StyleProfile {
  return mergeStyleProfiles(profile, buildStyleProfile(text, numberingStyle))
}
