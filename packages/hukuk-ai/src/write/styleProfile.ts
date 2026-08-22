/**
 * Üslup profili — plan M8.3 / M8.4, `docs/CAPABILITIES.md` A8.
 *
 * Şema `docs/STYLE-PROFILE.md`'de belgelenmiştir; bu dosyadaki tipler o
 * şemanın birebir karşılığıdır. `StyleProfile` yalnız JSON'a birebir
 * dönüşen alanlardan (sayı, dize, dizi, düz nesne) kuruludur — kalıcı
 * saklama veya cihazlar arası aktarım `JSON.stringify` ile yapılabilir.
 *
 * M8.4 — artımlı ve birleştirilebilir: `StyleProfileBuilder.add()` belgeleri
 * TEK TEK işler, hiçbiri aynı anda bellekte tutulmaz (yalnız çalışan
 * istatistikler tutulur — Welford algoritması). İki ayrı oturumda/derlemede
 * biriken durumlar `mergeState` ile matematiksel olarak birleştirilebilir;
 * "baştan say" gerekmez.
 */

import { extractStructure, type NumberingStyle } from './structure'
import { splitParagraphs, splitSentences, wordCount } from './textStats'

// ---------------------------------------------------------------------------
// Welford — çevrimiçi ortalama/varyans, birleştirilebilir
// ---------------------------------------------------------------------------

interface WelfordState {
  readonly n: number
  readonly mean: number
  readonly m2: number
  readonly min: number
  readonly max: number
}

export interface DistributionStats {
  readonly count: number
  readonly mean: number
  readonly min: number
  readonly max: number
  readonly stdDev: number
}

const EMPTY_WELFORD: WelfordState = { n: 0, mean: 0, m2: 0, min: Infinity, max: -Infinity }

function welfordAdd(state: WelfordState, value: number): WelfordState {
  const n = state.n + 1
  const delta = value - state.mean
  const mean = state.mean + delta / n
  const delta2 = value - mean
  const m2 = state.m2 + delta * delta2
  return { n, mean, m2, min: Math.min(state.min, value), max: Math.max(state.max, value) }
}

/** Standart paralel Welford birleştirme — iki bağımsız durumu tek geçişte toplar. */
function welfordMerge(a: WelfordState, b: WelfordState): WelfordState {
  if (a.n === 0) return b
  if (b.n === 0) return a

  const n = a.n + b.n
  const delta = b.mean - a.mean
  const mean = a.mean + (delta * b.n) / n
  const m2 = a.m2 + b.m2 + (delta * delta * a.n * b.n) / n
  return { n, mean, m2, min: Math.min(a.min, b.min), max: Math.max(a.max, b.max) }
}

function welfordSnapshot(state: WelfordState): DistributionStats {
  if (state.n === 0) return { count: 0, mean: 0, min: 0, max: 0, stdDev: 0 }
  const variance = state.n > 1 ? state.m2 / state.n : 0
  return { count: state.n, mean: state.mean, min: state.min, max: state.max, stdDev: Math.sqrt(variance) }
}

// ---------------------------------------------------------------------------
// Sözlük — kalıp ifadeler / terim tercihleri
//
// SORU: S7 — bu listeler bir başlangıç tohumudur, bürodan büroya değişir.
// Şimdilik sabit; genişletme yolu ileride kullanıcı sözlüğü ile açılabilir.
// Şimdilik seçilen varsayım: yaygın TR hukuk dilekçesi kalıpları.
// ---------------------------------------------------------------------------

const FORMULAIC_PHRASES: readonly string[] = [
  'yukarıda arz ve izah edilen nedenlerle',
  'yukarıda açıklanan nedenlerle',
  'sayın mahkemenizden',
  'saygılarımla arz ve talep ederim',
  'saygılarımızla arz ve talep ederiz',
  'bilcümle yasal hak ve alacaklarımız saklı kalmak kaydıyla',
  'fazlaya ilişkin haklarımız saklı kalmak kaydıyla',
  'davanın kabulüne karar verilmesini',
  'ekte sunulmuştur',
]

const TERM_VARIANTS: readonly (readonly string[])[] = [
  ['davacı taraf', 'davacı'],
  ['davalı taraf', 'davalı'],
  ['müvekkilim', 'müvekkil'],
  ['vekaleten', 'vekâleten'],
]

const SALUTATION_PATTERN = /(MAHKEMESİ|HAKİMLİĞİ|BAŞSAVCILIĞI)\s*'?(NE|YE)\s*$/i
const CLOSING_PATTERN = /(arz ve talep ederim|arz ederim|saygılarımla|saygılarımızla)/i

// `\b` bir ASCII kavramıdır (yalnız [A-Za-z0-9_] kelime sayılır); Türkçe
// harfle biten "sayılı" gibi sözcüklerde sınırı bulamaz. Unicode harf/rakam
// sınıfına dayalı olumsuz bakış açılarıyla aynı işi doğru yapıyoruz.
// Sayının hemen önünde "/" varsa ("K. 2020/5678 sayılı kararı" gibi) bu bir
// mevzuat atfı değil, karar numarasının parçasıdır — sayılmaz.
const LAW_REFERENCE = /(?<![\p{L}\p{N}/])\d+\s+sayılı(?![\p{L}\p{N}])/gu
const CASE_E_FIRST = /E\.\s*\d{4}\/\d+[^\n]{0,40}?K\.\s*\d{4}\/\d+/gu
const CASE_K_FIRST = /K\.\s*\d{4}\/\d+[^\n]{0,40}?E\.\s*\d{4}\/\d+/gu

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0
  return haystack.split(needle).length - 1
}

function countMatches(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length
}

// ---------------------------------------------------------------------------
// Public şema
// ---------------------------------------------------------------------------

export interface PhraseFrequency {
  readonly phrase: string
  readonly count: number
}

export type CaseOrder = 'e-first' | 'k-first' | 'unknown'

export interface CitationStyleStats {
  readonly lawReferenceCount: number
  readonly caseReferenceCount: number
  readonly caseOrder: CaseOrder
}

export interface RepresentativeExcerpt {
  readonly documentId: string
  readonly text: string
}

export interface StyleProfile {
  readonly documentCount: number
  readonly sentenceLength: DistributionStats
  readonly paragraphLength: DistributionStats
  readonly numberingStyle: NumberingStyle
  readonly formulaicPhrases: readonly PhraseFrequency[]
  readonly salutations: readonly PhraseFrequency[]
  readonly closings: readonly PhraseFrequency[]
  readonly citationStyle: CitationStyleStats
  readonly preferredTerms: readonly PhraseFrequency[]
  /** M8.5 few-shot seçiminin havuzu — her belgeden 2–3 temsilî paragraf. */
  readonly excerpts: readonly RepresentativeExcerpt[]
}

/** `StyleProfileBuilder`'ın kalıcı/aktarılabilir durumu — düz JSON. */
export interface StyleProfileBuilderState {
  readonly documentCount: number
  readonly sentence: WelfordState
  readonly paragraph: WelfordState
  readonly numbering: readonly (readonly [NumberingStyle, number])[]
  readonly phrases: readonly (readonly [string, number])[]
  readonly salutations: readonly (readonly [string, number])[]
  readonly closings: readonly (readonly [string, number])[]
  readonly terms: readonly (readonly [string, number])[]
  readonly lawReferenceCount: number
  readonly eFirstCount: number
  readonly kFirstCount: number
  readonly excerpts: readonly RepresentativeExcerpt[]
}

const EMPTY_STATE: StyleProfileBuilderState = {
  documentCount: 0,
  sentence: EMPTY_WELFORD,
  paragraph: EMPTY_WELFORD,
  numbering: [],
  phrases: [],
  salutations: [],
  closings: [],
  terms: [],
  lawReferenceCount: 0,
  eFirstCount: 0,
  kFirstCount: 0,
  excerpts: [],
}

function mapFromEntries(entries: readonly (readonly [string, number])[]): Map<string, number> {
  return new Map(entries)
}

function bump(map: Map<string, number>, key: string, amount = 1): void {
  map.set(key, (map.get(key) ?? 0) + amount)
}

function toSortedFrequencies(map: ReadonlyMap<string, number>): readonly PhraseFrequency[] {
  return [...map.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))
    .map(([phrase, count]) => ({ phrase, count }))
}

function mergeCountMap(
  a: readonly (readonly [string, number])[],
  b: readonly (readonly [string, number])[],
): readonly (readonly [string, number])[] {
  const merged = mapFromEntries(a)
  for (const [key, count] of b) bump(merged, key, count)
  return [...merged.entries()]
}

/** İki bağımsız `StyleProfileBuilderState`'i, hiç belgeyi yeniden okumadan birleştirir. */
export function mergeState(
  a: StyleProfileBuilderState,
  b: StyleProfileBuilderState,
): StyleProfileBuilderState {
  return {
    documentCount: a.documentCount + b.documentCount,
    sentence: welfordMerge(a.sentence, b.sentence),
    paragraph: welfordMerge(a.paragraph, b.paragraph),
    numbering: mergeCountMap(a.numbering, b.numbering) as readonly (readonly [NumberingStyle, number])[],
    phrases: mergeCountMap(a.phrases, b.phrases),
    salutations: mergeCountMap(a.salutations, b.salutations),
    closings: mergeCountMap(a.closings, b.closings),
    terms: mergeCountMap(a.terms, b.terms),
    lawReferenceCount: a.lawReferenceCount + b.lawReferenceCount,
    eFirstCount: a.eFirstCount + b.eFirstCount,
    kFirstCount: a.kFirstCount + b.kFirstCount,
    excerpts: [...a.excerpts, ...b.excerpts],
  }
}

function dominantNumbering(counts: ReadonlyMap<string, number>): NumberingStyle {
  const priority: readonly NumberingStyle[] = ['arabic', 'roman', 'letter', 'none']
  let best: NumberingStyle = 'none'
  let bestCount = -1
  for (const style of priority) {
    const count = counts.get(style) ?? 0
    if (count > bestCount) {
      best = style
      bestCount = count
    }
  }
  return best
}

/** Belgeden 2–3 temsilî paragraf: en uzun (içerik yoğun) paragraflar, orijinal sırayla. */
function pickRepresentativeExcerpts(documentId: string, text: string): readonly RepresentativeExcerpt[] {
  const paragraphs = splitParagraphs(text)
  const substantial = paragraphs
    .map((paragraph, index) => ({ paragraph, index, words: wordCount(paragraph) }))
    .filter((entry) => entry.words >= 8)

  const top = [...substantial].sort((a, b) => b.words - a.words).slice(0, 3)
  const topIndexes = new Set(top.map((entry) => entry.index))

  return substantial
    .filter((entry) => topIndexes.has(entry.index))
    .map((entry) => ({ documentId, text: entry.paragraph }))
}

/**
 * Üslup profilini artımlı toplar. Belgeler tek tek `add()` ile işlenir;
 * hiçbiri aynı anda bellekte tutulmaz. Durum `toState()` ile dışa alınabilir,
 * `fromState()` ile devam ettirilebilir, `mergeState()` ile birleştirilebilir.
 */
export class StyleProfileBuilder {
  #state: StyleProfileBuilderState

  constructor(initial: StyleProfileBuilderState = EMPTY_STATE) {
    this.#state = initial
  }

  static fromState(state: StyleProfileBuilderState): StyleProfileBuilder {
    return new StyleProfileBuilder(state)
  }

  toState(): StyleProfileBuilderState {
    return this.#state
  }

  add(documentId: string, text: string): void {
    const structure = extractStructure(text)
    const numbering = mapFromEntries(this.#state.numbering)
    bump(numbering, structure.numberingStyle)

    let sentence = this.#state.sentence
    let paragraph = this.#state.paragraph
    for (const para of splitParagraphs(text)) {
      paragraph = welfordAdd(paragraph, wordCount(para))
      for (const sentenceText of splitSentences(para)) {
        sentence = welfordAdd(sentence, wordCount(sentenceText))
      }
    }

    const normalized = text.toLocaleLowerCase('tr')
    const phrases = mapFromEntries(this.#state.phrases)
    for (const phrase of FORMULAIC_PHRASES) {
      const count = countOccurrences(normalized, phrase)
      if (count > 0) bump(phrases, phrase, count)
    }

    const terms = mapFromEntries(this.#state.terms)
    for (const variants of TERM_VARIANTS) {
      for (const variant of variants) {
        const count = countOccurrences(normalized, variant)
        if (count > 0) bump(terms, variant, count)
      }
    }

    const salutations = mapFromEntries(this.#state.salutations)
    const paragraphs = splitParagraphs(text)
    const firstLine = paragraphs[0]?.split('\n')[0]?.trim()
    if (firstLine && SALUTATION_PATTERN.test(firstLine)) bump(salutations, firstLine)

    const closings = mapFromEntries(this.#state.closings)
    const lastParagraph = paragraphs.at(-1)
    if (lastParagraph && lastParagraph.length <= 200 && CLOSING_PATTERN.test(lastParagraph)) {
      bump(closings, lastParagraph)
    }

    this.#state = {
      documentCount: this.#state.documentCount + 1,
      sentence,
      paragraph,
      numbering: [...numbering.entries()] as readonly (readonly [NumberingStyle, number])[],
      phrases: [...phrases.entries()],
      salutations: [...salutations.entries()],
      closings: [...closings.entries()],
      terms: [...terms.entries()],
      lawReferenceCount: this.#state.lawReferenceCount + countMatches(text, LAW_REFERENCE),
      eFirstCount: this.#state.eFirstCount + countMatches(text, CASE_E_FIRST),
      kFirstCount: this.#state.kFirstCount + countMatches(text, CASE_K_FIRST),
      excerpts: [...this.#state.excerpts, ...pickRepresentativeExcerpts(documentId, text)],
    }
  }

  build(): StyleProfile {
    const state = this.#state
    const caseReferenceCount = state.eFirstCount + state.kFirstCount
    const caseOrder: CaseOrder =
      caseReferenceCount === 0 ? 'unknown' : state.eFirstCount >= state.kFirstCount ? 'e-first' : 'k-first'

    return {
      documentCount: state.documentCount,
      sentenceLength: welfordSnapshot(state.sentence),
      paragraphLength: welfordSnapshot(state.paragraph),
      numberingStyle: dominantNumbering(mapFromEntries(state.numbering)),
      formulaicPhrases: toSortedFrequencies(mapFromEntries(state.phrases)),
      salutations: toSortedFrequencies(mapFromEntries(state.salutations)),
      closings: toSortedFrequencies(mapFromEntries(state.closings)),
      citationStyle: { lawReferenceCount: state.lawReferenceCount, caseReferenceCount, caseOrder },
      preferredTerms: toSortedFrequencies(mapFromEntries(state.terms)),
      excerpts: state.excerpts,
    }
  }
}
