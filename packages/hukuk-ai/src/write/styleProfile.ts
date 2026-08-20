/**
 * Üslup profili — plan M8.3 / M8.4, `docs/CAPABILITIES.md` A8.
 *
 * ÖNEMLİ KARAR (SORU: S7, bkz. `docs/QUESTIONS.md`): A8 "2–3 temsilî paragraf
 * örneklenip profile iliştirilir" der, ama görev talimatının değişmez kuralı
 * "ham kişisel veri diske hiç yazılmaz" der — profil kalıcı saklanan bir
 * yapıdır (belge belge birikir), o yüzden içine giren her metin parçası önce
 * `mask()`'tan geçirilir. Örnek paragraflar, hitap/kapanış kalıpları HER ZAMAN
 * maskelenmiş biçimde saklanır; ham metin bu modülden hiçbir alanda çıkmaz.
 *
 * Profil artımlıdır: her belge TEK BAŞINA işlenir (`addDocument`), sayısal
 * dağılımlar Welford'un çevrimiçi ortalama/varyans birleştirme formülüyle
 * güncellenir — N belgenin aynı anda bellekte olması gerekmez (A8 "bağlam
 * sınırı bağlamıyor").
 */

import { mask } from '../mask/mask'
import type { NerBackend } from '../mask/ner/types'
import { extractSkeleton, type NumberingScheme } from './skeleton'

export interface Distribution {
  readonly count: number
  readonly mean: number
  /** Welford M2 — kareli sapmalar toplamı; birleştirilebilir varyans. */
  readonly m2: number
}

export function stdDev(distribution: Distribution): number {
  return distribution.count > 0 ? Math.sqrt(distribution.m2 / distribution.count) : 0
}

const EMPTY_DISTRIBUTION: Distribution = { count: 0, mean: 0, m2: 0 }

function distributionFromSamples(samples: readonly number[]): Distribution {
  let count = 0
  let mean = 0
  let m2 = 0
  for (const value of samples) {
    count += 1
    const delta = value - mean
    mean += delta / count
    m2 += delta * (value - mean)
  }
  return { count, mean, m2 }
}

function combineDistributions(a: Distribution, b: Distribution): Distribution {
  if (a.count === 0) return b
  if (b.count === 0) return a
  const count = a.count + b.count
  const delta = b.mean - a.mean
  const mean = a.mean + (delta * b.count) / count
  const m2 = a.m2 + b.m2 + (delta * delta * a.count * b.count) / count
  return { count, mean, m2 }
}

export interface WeightedPhrase {
  readonly phrase: string
  readonly count: number
}

const MAX_PHRASES = 20

function mergePhrases(
  existing: readonly WeightedPhrase[],
  additions: readonly string[],
): readonly WeightedPhrase[] {
  if (additions.length === 0) return existing
  const counts = new Map(existing.map((entry) => [entry.phrase, entry.count]))
  for (const phrase of additions) counts.set(phrase, (counts.get(phrase) ?? 0) + 1)
  return [...counts.entries()]
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_PHRASES)
}

function mergeNumberingScheme(a: NumberingScheme, b: NumberingScheme): NumberingScheme {
  if (b === 'none') return a
  if (a === 'none') return b
  return a === b ? a : 'mixed'
}

export const STYLE_PROFILE_VERSION = 1

export interface StyleProfile {
  readonly version: typeof STYLE_PROFILE_VERSION
  readonly documentCount: number
  readonly sentenceLength: Distribution
  readonly paragraphLength: Distribution
  readonly numberingScheme: NumberingScheme
  /** Kalıp ifadeler (ör. "saygılarımla", "arz ve izah edilen") — maskeye gerek yok, sabit lügat. */
  readonly stockPhrases: readonly WeightedPhrase[]
  /** MASKELENMİŞ — belge başlarındaki hitap satırı. */
  readonly salutations: readonly WeightedPhrase[]
  /** MASKELENMİŞ — belge sonundaki kapanış satırı. */
  readonly closings: readonly WeightedPhrase[]
  readonly preferredTerms: readonly WeightedPhrase[]
  /** MASKELENMİŞ temsilî paragraflar — A8. Ham metin asla girmez. */
  readonly sampleParagraphs: readonly string[]
}

export function createEmptyProfile(): StyleProfile {
  return {
    version: STYLE_PROFILE_VERSION,
    documentCount: 0,
    sentenceLength: EMPTY_DISTRIBUTION,
    paragraphLength: EMPTY_DISTRIBUTION,
    numberingScheme: 'none',
    stockPhrases: [],
    salutations: [],
    closings: [],
    preferredTerms: [],
    sampleParagraphs: [],
  }
}

/** Sabit lügat — dedektörsüz, tamamen kural tabanlı tarama (M8'de model gerekmez). */
const STOCK_PHRASES = [
  'yukarıda arz ve izah edilen',
  'gereğinin bilgilerinize arz ederim',
  'saygılarımla',
  'sayın hakimliğinize',
  'kabulüne karar verilmesini',
  'fazlaya ilişkin haklarımız saklı kalmak kaydıyla',
]

const PREFERRED_TERMS = [
  'esas no',
  'karar no',
  'tebligat',
  'istinaf',
  'temyiz',
  'adli tatil',
  'gider avansı',
  'vekâlet ücreti',
  'vekalet ücreti',
  'davacı',
  'davalı',
  'müvekkil',
  'hasım',
  'ıslah',
  'harç',
]

const MAX_SAMPLE_PARAGRAPHS = 30
const MAX_SAMPLE_LENGTH = 500

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0
  let count = 0
  let index = haystack.indexOf(needle)
  while (index !== -1) {
    count += 1
    index = haystack.indexOf(needle, index + needle.length)
  }
  return count
}

function scanLexicon(lowerText: string, lexicon: readonly string[]): string[] {
  const hits: string[] = []
  for (const phrase of lexicon) {
    const occurrences = countOccurrences(lowerText, phrase)
    for (let i = 0; i < occurrences; i++) hits.push(phrase)
  }
  return hits
}

function wordCount(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return words.length
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

/** Salutation heuristiği: belgenin ilk anlamlı satırı, "Sayın" ile başlıyorsa. */
function detectSalutation(lines: readonly string[]): string | undefined {
  const first = lines.find((line) => line.trim().length > 0)
  if (!first) return undefined
  const trimmed = first.trim()
  return /^sayın\b/i.test(trimmed) ? trimmed : undefined
}

/** Closing heuristiği: son anlamlı satır, kısa ve büyük harf başlık değilse. */
function detectClosing(lines: readonly string[]): string | undefined {
  const last = [...lines].reverse().find((line) => line.trim().length > 0)
  if (!last) return undefined
  const trimmed = last.trim()
  if (trimmed.length > 60) return undefined
  if (trimmed === trimmed.toLocaleUpperCase('tr')) return undefined
  return trimmed
}

export interface AddDocumentOptions {
  /** Maskeleme sırasında NER katmanı da çalışsın diye — bkz. `mask()`. */
  readonly ner?: NerBackend
}

/**
 * Bir belgeyi profile ekler. Belge TEK BAŞINA işlenir; önceki belgelerin
 * ham metnine ihtiyaç yoktur, yalnız birikmiş `profile` gerekir (M8.4).
 */
export function addDocument(
  profile: StyleProfile,
  text: string,
  options: AddDocumentOptions = {},
): StyleProfile {
  const masked = mask(text, options.ner ? { ner: options.ner } : {}).text
  const lower = masked.toLocaleLowerCase('tr')
  const lines = masked.split('\n')
  const paragraphs = splitParagraphs(masked)

  const sampleParagraphs = [...paragraphs]
    .sort((a, b) => wordCount(b) - wordCount(a))
    .slice(0, 3)
    .map((paragraph) => paragraph.slice(0, MAX_SAMPLE_LENGTH))

  const salutation = detectSalutation(lines)
  const closing = detectClosing(lines)

  return {
    version: STYLE_PROFILE_VERSION,
    documentCount: profile.documentCount + 1,
    sentenceLength: combineDistributions(
      profile.sentenceLength,
      distributionFromSamples(splitSentences(masked).map(wordCount)),
    ),
    paragraphLength: combineDistributions(
      profile.paragraphLength,
      distributionFromSamples(paragraphs.map(wordCount)),
    ),
    numberingScheme: mergeNumberingScheme(
      profile.numberingScheme,
      extractSkeleton(masked).numberingScheme,
    ),
    stockPhrases: mergePhrases(profile.stockPhrases, scanLexicon(lower, STOCK_PHRASES)),
    salutations: mergePhrases(profile.salutations, salutation ? [salutation] : []),
    closings: mergePhrases(profile.closings, closing ? [closing] : []),
    preferredTerms: mergePhrases(profile.preferredTerms, scanLexicon(lower, PREFERRED_TERMS)),
    sampleParagraphs: [...profile.sampleParagraphs, ...sampleParagraphs].slice(
      -MAX_SAMPLE_PARAGRAPHS,
    ),
  }
}
