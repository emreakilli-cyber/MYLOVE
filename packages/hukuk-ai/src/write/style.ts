/**
 * Üslup profili — plan M8.3 / M8.4, `CAPABILITIES.md` A8.
 *
 * Profil **artımlıdır**: her dilekçe tek tek, bağımsız işlenir
 * (`extractStyleProfile`) ve önceki profille birleştirilir
 * (`mergeStyleProfiles`). Hiçbir aşama iki belgeyi aynı anda bağlamda tutmaz.
 *
 * Sözlük/dilbilgisi kütüphanesi yok (paket sıfır bağımlı) — istatistikler
 * bölme/sayma tabanlı sezgisellerdir, tam bir dilbilimsel çözümleme değildir.
 */

import { type NumberingScheme, extractSkeleton } from './skeleton'

export interface RunningStats {
  readonly count: number
  readonly total: number
  readonly min: number
  readonly max: number
}

export interface PhraseFrequency {
  readonly phrase: string
  readonly count: number
}

export interface StyleProfile {
  readonly documentCount: number
  readonly sentenceLength: RunningStats
  readonly paragraphLength: RunningStats
  /** N-gram tabanlı kalıp ifadeler — birden çok kez geçen 3-5 kelimelik öbekler. */
  readonly boilerplatePhrases: readonly PhraseFrequency[]
  readonly numberingStyle: Readonly<Record<NumberingScheme, number>>
  readonly salutations: readonly PhraseFrequency[]
  readonly closings: readonly PhraseFrequency[]
  readonly citationStyles: readonly PhraseFrequency[]
  readonly termPreferences: readonly PhraseFrequency[]
}

const TOP_N = 10

function mean(stats: RunningStats): number {
  return stats.count === 0 ? 0 : stats.total / stats.count
}

function emptyStats(): RunningStats {
  return { count: 0, total: 0, min: 0, max: 0 }
}

function statsFromLengths(lengths: readonly number[]): RunningStats {
  if (lengths.length === 0) return emptyStats()
  return {
    count: lengths.length,
    total: lengths.reduce((sum, value) => sum + value, 0),
    min: Math.min(...lengths),
    max: Math.max(...lengths),
  }
}

function mergeStats(a: RunningStats, b: RunningStats): RunningStats {
  if (a.count === 0) return b
  if (b.count === 0) return a
  return {
    count: a.count + b.count,
    total: a.total + b.total,
    min: Math.min(a.min, b.min),
    max: Math.max(a.max, b.max),
  }
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[\p{Lu}"'“(])/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
}

function wordCount(text: string): number {
  const words = text.trim().split(/\s+/u).filter(Boolean)
  return words.length
}

/** 3-5 kelimelik öbekleri sayar; iki veya daha çok kez geçenler kalıp adayıdır. */
function ngramFrequencies(text: string): PhraseFrequency[] {
  const words = text
    .toLocaleLowerCase('tr')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/u)
    .filter(Boolean)

  const counts = new Map<string, number>()
  for (const n of [3, 4, 5]) {
    for (let i = 0; i + n <= words.length; i += 1) {
      const phrase = words.slice(i, i + n).join(' ')
      counts.set(phrase, (counts.get(phrase) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([phrase, count]) => ({ phrase, count }))
}

const SALUTATION_PATTERNS: readonly RegExp[] = [
  /Sayın\s+[\p{L}.\s]*(Mahkeme(si|miz)?|Hâkimliğ?e?|Hakimliğ?e?|Başkanlığ?ı?ı?n?a?|Cumhuriyet Başsavcılığına)[^\n.]{0,40}/gu,
]

const CLOSING_PATTERNS: readonly RegExp[] = [
  /Saygı(larım|larımızı|larımla)[^\n.]{0,60}\.?/gu,
  /Arz\s+(ve\s+)?(talep\s+)?ederim\.?/gu,
  /Bilgilerinize\s+(arz|sunar)[^\n.]{0,40}\.?/gu,
]

const CITATION_PATTERNS: readonly RegExp[] = [
  /Yargıtay\s+\d+\.\s*(Hukuk|Ceza)\s*Dairesi[^\n.]{0,80}/gu,
  /E\.\s*\d{4}\/\d+[,\s]*K\.\s*\d{4}\/\d+/gu,
]

function matchAll(text: string, patterns: readonly RegExp[]): PhraseFrequency[] {
  const counts = new Map<string, number>()
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const phrase = match[0].trim()
      counts.set(phrase, (counts.get(phrase) ?? 0) + 1)
    }
  }
  return [...counts.entries()].map(([phrase, count]) => ({ phrase, count }))
}

/**
 * Sık kullanılan terimler — Türkçede en az 4 harfli, yaygın bağlaç/edat
 * kümesinin dışındaki sözcüklerin frekansı. Terim TERCİHİNİ (eş anlamlılar
 * arasından hangisi seçildiğini) göstermek içindir, genel bir kelime
 * frekansı sözlüğü değildir.
 */
const STOPWORDS = new Set([
  've', 'ile', 'için', 'gibi', 'daha', 'çok', 'bir', 'bu', 'şu', 'o',
  'da', 'de', 'ki', 'ise', 'ancak', 'fakat', 'ama', 'veya', 'ya', 'olan',
  'olarak', 'göre', 'kadar', 'sonra', 'önce', 'her', 'hiç', 'tüm', 'bütün',
])

function termFrequencies(text: string): PhraseFrequency[] {
  const words = text
    .toLocaleLowerCase('tr')
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/u)
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word))

  const counts = new Map<string, number>()
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1)

  return [...counts.entries()].map(([phrase, count]) => ({ phrase, count }))
}

function mergePhraseFrequencies(
  a: readonly PhraseFrequency[],
  b: readonly PhraseFrequency[],
  topN = TOP_N,
): readonly PhraseFrequency[] {
  const counts = new Map<string, number>()
  for (const { phrase, count } of [...a, ...b]) counts.set(phrase, (counts.get(phrase) ?? 0) + count)

  return [...counts.entries()]
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((x, y) => y.count - x.count || x.phrase.localeCompare(y.phrase, 'tr'))
    .slice(0, topN)
}

const EMPTY_NUMBERING_STYLE: Readonly<Record<NumberingScheme, number>> = {
  decimal: 0,
  roman: 0,
  alpha: 0,
  none: 0,
  mixed: 0,
}

/** Tek bir dilekçeden bağımsız, kısmi bir üslup profili çıkarır (M8.3). */
export function extractStyleProfile(text: string): StyleProfile {
  const sentences = splitSentences(text)
  const paragraphs = splitParagraphs(text)
  const skeleton = extractSkeleton(text)

  return {
    documentCount: 1,
    sentenceLength: statsFromLengths(sentences.map(wordCount)),
    paragraphLength: statsFromLengths(paragraphs.map((paragraph) => splitSentences(paragraph).length)),
    boilerplatePhrases: ngramFrequencies(text).sort((a, b) => b.count - a.count).slice(0, TOP_N),
    numberingStyle: { ...EMPTY_NUMBERING_STYLE, [skeleton.numberingScheme]: 1 },
    salutations: matchAll(text, SALUTATION_PATTERNS),
    closings: matchAll(text, CLOSING_PATTERNS),
    citationStyles: matchAll(text, CITATION_PATTERNS),
    termPreferences: termFrequencies(text),
  }
}

/**
 * İki profili birleştirir — artımlı toplama (M8.4). Sıra fark etmez
 * (birleştirici birleşimseldir); belge belge, oturum oturum uygulanabilir.
 */
export function mergeStyleProfiles(a: StyleProfile, b: StyleProfile): StyleProfile {
  const numberingStyle: Record<NumberingScheme, number> = { ...EMPTY_NUMBERING_STYLE }
  for (const scheme of Object.keys(numberingStyle) as NumberingScheme[]) {
    numberingStyle[scheme] = a.numberingStyle[scheme] + b.numberingStyle[scheme]
  }

  return {
    documentCount: a.documentCount + b.documentCount,
    sentenceLength: mergeStats(a.sentenceLength, b.sentenceLength),
    paragraphLength: mergeStats(a.paragraphLength, b.paragraphLength),
    boilerplatePhrases: mergePhraseFrequencies(a.boilerplatePhrases, b.boilerplatePhrases),
    numberingStyle,
    salutations: mergePhraseFrequencies(a.salutations, b.salutations),
    closings: mergePhraseFrequencies(a.closings, b.closings),
    citationStyles: mergePhraseFrequencies(a.citationStyles, b.citationStyles),
    termPreferences: mergePhraseFrequencies(a.termPreferences, b.termPreferences),
  }
}

/** Ortalama cümle/paragraf uzunluğu okunabilir yardımcılar. */
export function meanSentenceWords(profile: StyleProfile): number {
  return mean(profile.sentenceLength)
}

export function meanParagraphSentences(profile: StyleProfile): number {
  return mean(profile.paragraphLength)
}

/** Boş, sıfırdan başlayan profil — `mergeStyleProfiles` için birim eleman. */
export function emptyStyleProfile(): StyleProfile {
  return {
    documentCount: 0,
    sentenceLength: emptyStats(),
    paragraphLength: emptyStats(),
    boilerplatePhrases: [],
    numberingStyle: { ...EMPTY_NUMBERING_STYLE },
    salutations: [],
    closings: [],
    citationStyles: [],
    termPreferences: [],
  }
}
