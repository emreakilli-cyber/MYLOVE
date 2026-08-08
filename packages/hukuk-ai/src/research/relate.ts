/**
 * Karar özetleme ve olayla ilişkilendirme — plan M7.6, `CAPABILITIES.md` A6.
 *
 * ## Mimari kural: K bağımsız kısa geçiş
 *
 * Kullanıcının olay özeti kısadır (< 800 token). Aday kararlar ise toplamda
 * uzundur. Bunları TEK bağlamda birleştirmek telefonun penceresini aşar.
 *
 * Bu yüzden her aday karar, olay özetiyle birlikte KENDİ geçişinde
 * değerlendirilir: 10 karar → 10 bağımsız kısa çağrı. Hiçbir çağrı diğerini
 * görmez. Bu, telefonun 4–8 K penceresine sığmanın yanı sıra işi doğal olarak
 * kesintiye dayanıklı yapar — beşinci kararda uygulama kapanırsa altıncıdan
 * devam edilir (`CAPABILITIES.md` §A.0).
 *
 * Uzun bir kararın kendisi bile bütçeyi aşabilir; o durumda karar da parçalanır
 * ve parça değerlendirmeleri deterministik olarak birleştirilir.
 */

import {
  ContextBudgetError,
  assertWithinBudget,
  estimateTokens,
  type LocalModel,
} from '../llm/types'
import type { ResearchDocument } from './client'

/** Kullanıcının olayı — kısa tutulmak zorunda. */
export interface CaseFacts {
  /** Maskelenmiş olay özeti. */
  readonly summary: string
}

export interface RelevanceVerdict {
  readonly documentId: string
  /** Model karar veremediyse `undefined` — uydurulmaz. */
  readonly relevant: boolean | undefined
  /** 0..1. Karar verilemediyse `undefined`. */
  readonly score: number | undefined
  readonly matching: readonly string[]
  readonly diverging: readonly string[]
  readonly note: string
  /** Kaç bağımsız geçişte değerlendirildi (uzun karar parçalanmış olabilir). */
  readonly passes: number
}

export interface RelateOptions {
  /** Olay özeti için üst sınır. Aşılırsa hata; sessizce kırpılmaz. */
  readonly maxFactsTokens?: number
  /** Her geçişte çıktıya ayrılan pay. */
  readonly reservedForOutput?: number
  /** İlerleme bildirimi — kuyruk arayüzü bunu gösterir. */
  readonly onProgress?: (done: number, total: number) => void
}

const DEFAULT_MAX_FACTS_TOKENS = 800
const DEFAULT_RESERVED_OUTPUT = 256

function relevancePrompt(facts: string, excerpt: string): string {
  return [
    'Aşağıdaki olay ile kararı karşılaştır.',
    '',
    'OLAY:',
    facts,
    '',
    'KARAR:',
    excerpt,
    '',
    'Yalnız şu JSON ile yanıtla, başka hiçbir şey yazma:',
    '{"ilgili": true|false, "puan": 0.0-1.0, "benzesen": ["..."], "ayrisan": ["..."], "not": "..."}',
    'Emin değilsen "ilgili" alanını null bırak.',
  ].join('\n')
}

interface ParsedVerdict {
  relevant: boolean | undefined
  score: number | undefined
  matching: string[]
  diverging: string[]
  note: string
}

/**
 * Model çıktısı GÜVENİLMEZ girdidir. Bozuk JSON, fazladan metin, eksik alan
 * hepsi olağan; hiçbiri çökmeye yol açmamalı ve hiçbiri uydurmaya dönüşmemeli.
 * Ayrıştırılamayan çıktı "karar verilemedi" olur, "ilgisiz" olmaz — ikisi
 * farklı şeydir ve kullanıcı farkı görmeli.
 */
function parseVerdict(raw: string): ParsedVerdict {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) {
    return {
      relevant: undefined,
      score: undefined,
      matching: [],
      diverging: [],
      note: 'Model yanıtı ayrıştırılamadı.',
    }
  }

  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
    const score = typeof parsed['puan'] === 'number' ? parsed['puan'] : undefined

    return {
      relevant: typeof parsed['ilgili'] === 'boolean' ? parsed['ilgili'] : undefined,
      score: score === undefined ? undefined : Math.min(1, Math.max(0, score)),
      matching: toStringArray(parsed['benzesen']),
      diverging: toStringArray(parsed['ayrisan']),
      note: typeof parsed['not'] === 'string' ? parsed['not'] : '',
    }
  } catch {
    return {
      relevant: undefined,
      score: undefined,
      matching: [],
      diverging: [],
      note: 'Model yanıtı geçerli JSON değil.',
    }
  }
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

/**
 * Kararı, tek geçişe sığan parçalara böler.
 *
 * Bütçe sıfır veya negatifse bölünecek bir şey yoktur ve döngü ilerleyemez.
 * Denetim burada, çağıranın hesabına güvenilmiyor: `summarizeDocument` küçük
 * pencereli bir modelde negatif bütçe üretip bu fonksiyonu sonsuz döngüye
 * sokmuştu.
 */
export function splitForBudget(text: string, budgetTokens: number): readonly string[] {
  if (budgetTokens <= 0) {
    throw new ContextBudgetError(estimateTokens(text), budgetTokens)
  }
  if (estimateTokens(text) <= budgetTokens) return [text]

  const maxChars = budgetTokens * 3
  const parts: string[] = []
  let remaining = text

  while (remaining.length > maxChars) {
    // Cümle sınırında bölmeyi dene; yoksa boşlukta; o da yoksa sert kes.
    const window = remaining.slice(0, maxChars)
    const cut =
      Math.max(window.lastIndexOf('. '), window.lastIndexOf('\n')) > maxChars / 2
        ? Math.max(window.lastIndexOf('. '), window.lastIndexOf('\n')) + 1
        : window.lastIndexOf(' ') > 0
          ? window.lastIndexOf(' ')
          : maxChars

    parts.push(remaining.slice(0, cut).trim())
    remaining = remaining.slice(cut).trim()
  }
  if (remaining.length > 0) parts.push(remaining)

  return parts
}

/**
 * Her aday kararı olayla ayrı ayrı ilişkilendirir.
 *
 * Kararlar birbirini görmez ve tek bir uzun bağlam kurulmaz — mimari kural bu
 * fonksiyonun içinde uygulanır, çağıranın dikkatine bırakılmaz.
 */
export async function relateToCase(
  facts: CaseFacts,
  documents: readonly ResearchDocument[],
  model: LocalModel,
  options: RelateOptions = {},
): Promise<readonly RelevanceVerdict[]> {
  const maxFacts = options.maxFactsTokens ?? DEFAULT_MAX_FACTS_TOKENS
  const reserved = options.reservedForOutput ?? DEFAULT_RESERVED_OUTPUT

  const factsTokens = estimateTokens(facts.summary)
  if (factsTokens > maxFacts) {
    // Olay özeti K geçişin HEPSİNE giriyor; şişmesi bütün bütçeyi bozar.
    // Sessizce kırpmak, kullanıcının yazdığı olguyu habersiz atmak olurdu.
    throw new RangeError(
      `Olay özeti ${factsTokens} token, sınır ${maxFacts}. Önce özeti kısaltın.`,
    )
  }

  // Bir geçişte karara kalan pay: bütçe − olay − çıktı − istem iskeleti.
  const overhead = estimateTokens(relevancePrompt(facts.summary, ''))
  const perPassBudget = model.contextTokens - overhead - reserved
  if (perPassBudget <= 0) {
    throw new RangeError('Model penceresi bu olay özeti için yetersiz.')
  }

  const verdicts: RelevanceVerdict[] = []
  for (const [index, document] of documents.entries()) {
    const chunks = splitForBudget(document.excerpt, perPassBudget)
    const parsed: ParsedVerdict[] = []

    for (const chunk of chunks) {
      const prompt = relevancePrompt(facts.summary, chunk)
      assertWithinBudget(prompt, model, reserved)
      parsed.push(parseVerdict(await model.generate({ prompt, maxOutputTokens: reserved })))
    }

    verdicts.push(mergeVerdicts(document.id, parsed))
    options.onProgress?.(index + 1, documents.length)
  }

  return verdicts
}

/**
 * Parça kararlarını deterministik birleştirir: bir parça bile ilgili dediyse
 * karar ilgilidir (kaçırmak, fazladan göstermekten pahalı), puan en yükseği,
 * gerekçeler birleşir.
 */
function mergeVerdicts(documentId: string, parts: readonly ParsedVerdict[]): RelevanceVerdict {
  const decided = parts.filter((part) => part.relevant !== undefined)

  return {
    documentId,
    relevant: decided.length === 0 ? undefined : decided.some((part) => part.relevant === true),
    score: decided.length === 0
      ? undefined
      : Math.max(...decided.map((part) => part.score ?? 0)),
    matching: [...new Set(parts.flatMap((part) => part.matching))],
    diverging: [...new Set(parts.flatMap((part) => part.diverging))],
    note: parts.map((part) => part.note).filter(Boolean).join(' '),
    passes: parts.length,
  }
}

/**
 * Tek kararı özetler. Karar bütçeyi aşarsa parça özetleri alınır ve bunlar
 * ikinci bir kısa geçişte birleştirilir — `CAPABILITIES.md` A5'in aynı kalıbı.
 */
export async function summarizeDocument(
  document: ResearchDocument,
  model: LocalModel,
  reservedForOutput = DEFAULT_RESERVED_OUTPUT,
): Promise<string> {
  const build = (body: string): string =>
    `Aşağıdaki kararı en fazla beş cümlede özetle.\n\nKARAR:\n${body}\n\nÖZET:`

  const overhead = estimateTokens(build(''))
  const perPassBudget = model.contextTokens - overhead - reservedForOutput
  const chunks = splitForBudget(document.excerpt, perPassBudget)

  const partials: string[] = []
  for (const chunk of chunks) {
    const prompt = build(chunk)
    assertWithinBudget(prompt, model, reservedForOutput)
    partials.push((await model.generate({ prompt, maxOutputTokens: reservedForOutput })).trim())
  }

  if (partials.length === 1) return partials[0] ?? ''

  const merged = build(partials.join('\n'))
  assertWithinBudget(merged, model, reservedForOutput)
  return (await model.generate({ prompt: merged, maxOutputTokens: reservedForOutput })).trim()
}
