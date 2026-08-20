/**
 * Üslup profili — plan M8.3 / M8.4, `CAPABILITIES.md` A8 adım (b).
 *
 * Tek belgeden `buildStyleProfile` bir profil üretir; `mergeStyleProfile` bunu
 * var olan bir profille birleştirir. Birleşme değişmeli ve birleşimlidir
 * (`merge(merge(a,b),c) === merge(a,merge(b,c))`), bu yüzden belgeler HANGİ
 * SIRAYLA işlenirse işlensin, hatta oturumlar arasında kesintiye uğrasa bile
 * aynı toplam profile ulaşılır (A8: "artımlı, birleştirilebilir").
 *
 * Model kullanmaz: cümle/paragraf uzunluğu sayımdır; kalıp ifade, hitap/kapanış,
 * atıf ve terim tercihi tespiti küratörlü desen eşlemesidir. Model katmanı
 * ileride eklenebilir ama üslup öğrenme sırası (A8) fine-tuning'den ÖNCE bunu
 * ister — bkz. `docs/MODEL.md` §4.
 */

import { extractSkeleton, type NumberingScheme } from './skeleton'
import {
  distributionOf,
  type Distribution,
  mergeDistribution,
  mergeFrequencies,
  type PhraseFrequency,
} from './types'

/** Sık kullanılan hukuki kalıp ifadeler (M8.3). Küçük harfe çevrilip aranır. */
const STOCK_PHRASES: readonly string[] = [
  'yukarıda arz ve izah edilen nedenlerle',
  'yukarıda açıklanan nedenlerle',
  'arz ve izah edilen nedenlerle',
  'açıklanan nedenlerle',
  'yukarıda arz olunan nedenlerle',
  'bilgilerinize sunarım',
  'bilgilerinize sunarız',
  'takdir yüce mahkemenizindir',
  'saygılarımla arz ederim',
  'saygılarımla arz ederiz',
]

/** Kapanış/imza satırlarında görülen sıfat kalıpları. */
const CLOSING_PHRASES: readonly string[] = [
  'davacı vekili',
  'davalı vekili',
  'müşteki vekili',
  'şüpheli müdafii',
  'sanık müdafii',
  'katılan vekili',
  'saygılarımla',
  'saygılarımızla',
]

/** Mahkemeye/makama hitap eden başlık satırı — genelde belgenin ilk satırlarında. */
const GREETING_PATTERN =
  /[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ '.]{2,80}(?:MAHKEMESİ|BAŞSAVCILIĞI|HAKİMLİĞİ|ADLİYESİ)[’']?(?:NE|NA)\b/gu

/** Kanun maddesi / Yargıtay dairesi atıf kalıpları. */
const CITATION_PATTERNS: readonly RegExp[] = [
  /\b[A-ZÇĞİÖŞÜ]{2,6}\s?m(?:d)?\.\s?\d+/gu,
  /\b\d+\s+sayılı[^.,;\n]{0,60}?(?:Kanun|Kanunu|Yönetmelik|Tüzük)['’]?(?:nun|nün|un|ün|nin|nın)?/gu,
  /Yargıtay\s+\d+\.\s+(?:Hukuk|Ceza)\s+Dairesi/gu,
]

/**
 * Eş anlamlı terim grupları — hangi varyantın tercih edildiğini izler.
 * Amaç doğru/yanlış ayırmak değil, kullanıcının **alışkanlığını** yakalamak.
 */
const TERM_GROUPS: ReadonlyArray<readonly string[]> = [
  ['davacı', 'müvekkil'],
  ['tazminat', 'zarar ziyan'],
  ['fesih', 'sona erdirme'],
  ['ihtar', 'ihtarname'],
  ['beyan', 'ifade'],
]

/**
 * Birden çok fazla profil biriktiğinde `sampleParagraphs` sınırsız büyümesin
 * diye tutulan üst sınır (A8: "birkaç KB'lık tek profil"). 200 belgelik bir
 * korpusta belge başına 2-3 paragraf birikirse bu, birkaç KB'ı kolayca aşar;
 * bu yüzden en SON eklenenler tutulur, eskiler düşer.
 * SORU: S8 — bkz. docs/QUESTIONS.md.
 */
const MAX_SAMPLE_PARAGRAPHS = 24

export interface StyleProfile {
  readonly documentCount: number
  readonly sentenceLength: Distribution
  readonly paragraphLength: Distribution
  readonly stockPhrases: readonly PhraseFrequency[]
  readonly numberingStyle: readonly PhraseFrequency[]
  readonly greetingPhrases: readonly PhraseFrequency[]
  readonly closingPhrases: readonly PhraseFrequency[]
  readonly citationPhrases: readonly PhraseFrequency[]
  readonly termPreferences: readonly PhraseFrequency[]
  /** A8: her belgeden örneklenen 2-3 temsilî paragraf (M8.5'in few-shot kaynağı). */
  readonly sampleParagraphs: readonly string[]
}

const ABBREVIATIONS = new Set([
  'av', 'dr', 'prof', 'doç', 'sn', 'sy', 'vs', 'bkz', 'mad', 'no', 'yy', 'sok', 'mah', 'cad',
])

function wordCount(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return words.length
}

function lastWordBefore(text: string): string {
  const stripped = text.replace(/[.!?]+$/, '')
  const match = /(\p{L}+)$/u.exec(stripped)
  return match?.[1]?.toLocaleLowerCase('tr') ?? ''
}

/**
 * Kaba ama denetimli cümle bölücü. `Av. Ahmet` gibi kısaltmalardan sonraki
 * noktada bölmez (kısaltma listesine bakar); geri kalanı `[.!?]` + boşluk
 * sınırından böler.
 */
function splitSentences(text: string): string[] {
  const chunks = text.split(/(?<=[.!?])\s+/)
  const sentences: string[] = []
  let buffer = ''

  for (const chunk of chunks) {
    buffer = buffer ? `${buffer} ${chunk}` : chunk
    if (ABBREVIATIONS.has(lastWordBefore(buffer))) continue
    sentences.push(buffer.trim())
    buffer = ''
  }
  if (buffer.trim().length > 0) sentences.push(buffer.trim())

  return sentences.filter((sentence) => sentence.length > 0)
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter((paragraph) => paragraph.length > 0)
}

function countPhrases(text: string, phrases: readonly string[]): PhraseFrequency[] {
  const lower = text.toLocaleLowerCase('tr')
  const result: PhraseFrequency[] = []
  for (const phrase of phrases) {
    let count = 0
    let from = 0
    for (;;) {
      const index = lower.indexOf(phrase, from)
      if (index < 0) break
      count += 1
      from = index + phrase.length
    }
    if (count > 0) result.push({ phrase, count })
  }
  return result
}

function countCitations(text: string): PhraseFrequency[] {
  const counts = new Map<string, number>()
  for (const pattern of CITATION_PATTERNS) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const normalized = match[0].replace(/\s+/g, ' ').trim()
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
    }
  }
  return [...counts.entries()].map(([phrase, count]) => ({ phrase, count }))
}

function countGreetings(text: string): PhraseFrequency[] {
  const counts = new Map<string, number>()
  GREETING_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = GREETING_PATTERN.exec(text)) !== null) {
    const normalized = match[0].replace(/\s+/g, ' ').trim()
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
  }
  return [...counts.entries()].map(([phrase, count]) => ({ phrase, count }))
}

function countTermPreferences(text: string): PhraseFrequency[] {
  const flat = TERM_GROUPS.flat()
  return countPhrases(text, flat)
}

function numberingStyleOf(scheme: NumberingScheme): readonly PhraseFrequency[] {
  return [{ phrase: scheme, count: 1 }]
}

/**
 * Few-shot bağlamına (M8.5) girecek temsilî paragraflar: çok kısa (başlık
 * olma ihtimali yüksek) ve aşırı uzun paragraflar elenir, kalanlardan ilk
 * `MAX_PER_DOCUMENT` tanesi alınır. A8: "her belgeden 2-3 temsilî paragraf".
 */
const MAX_PER_DOCUMENT = 3
const MIN_PARAGRAPH_WORDS = 15

function sampleRepresentativeParagraphs(paragraphs: readonly string[]): string[] {
  return paragraphs.filter((p) => wordCount(p) >= MIN_PARAGRAPH_WORDS).slice(0, MAX_PER_DOCUMENT)
}

export function buildStyleProfile(document: string): StyleProfile {
  const sentences = splitSentences(document)
  const paragraphs = splitParagraphs(document)
  const skeleton = extractSkeleton(document)

  return {
    documentCount: 1,
    sentenceLength: distributionOf(sentences.map(wordCount)),
    paragraphLength: distributionOf(paragraphs.map(wordCount)),
    stockPhrases: countPhrases(document, STOCK_PHRASES),
    numberingStyle: numberingStyleOf(skeleton.numberingScheme),
    greetingPhrases: countGreetings(document),
    closingPhrases: countPhrases(document, CLOSING_PHRASES),
    citationPhrases: countCitations(document),
    termPreferences: countTermPreferences(document),
    sampleParagraphs: sampleRepresentativeParagraphs(paragraphs),
  }
}

/**
 * İki profili birleştirir (M8.4). `base` olmadan (ilk belge) `next` aynen
 * döner. Sıra bağımsızdır — testle doğrulanır.
 */
export function mergeStyleProfile(
  base: StyleProfile | undefined,
  next: StyleProfile,
): StyleProfile {
  if (!base) return next

  const sampleParagraphs = [...base.sampleParagraphs, ...next.sampleParagraphs].slice(
    -MAX_SAMPLE_PARAGRAPHS,
  )

  return {
    documentCount: base.documentCount + next.documentCount,
    sentenceLength: mergeDistribution(base.sentenceLength, next.sentenceLength),
    paragraphLength: mergeDistribution(base.paragraphLength, next.paragraphLength),
    stockPhrases: mergeFrequencies(base.stockPhrases, next.stockPhrases),
    numberingStyle: mergeFrequencies(base.numberingStyle, next.numberingStyle),
    greetingPhrases: mergeFrequencies(base.greetingPhrases, next.greetingPhrases),
    closingPhrases: mergeFrequencies(base.closingPhrases, next.closingPhrases),
    citationPhrases: mergeFrequencies(base.citationPhrases, next.citationPhrases),
    termPreferences: mergeFrequencies(base.termPreferences, next.termPreferences),
    sampleParagraphs,
  }
}
