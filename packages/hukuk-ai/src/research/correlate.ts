/**
 * Sonuç özetleme ve olayla ilişkilendirme — plan M7.6.
 *
 * `CAPABILITIES.md` A6: "İlk-K karar için K bağımsız kısa geçiş." Her aday
 * karar, olay özetiyle TEK BAŞINA değerlendirilir; hiçbir çağrı birden fazla
 * kararı aynı pencereye almaz. Bu, arayüzle zorlanır: `CorrelationBackend`
 * bilerek dizi değil TEK `ResearchDocument` alır — çağıran taraf adayları
 * toplu bağlama sokmak istese bile tip bunu engeller.
 */

import type { ResearchDocument } from './client'
import { assertMasked, type GuardOptions } from './guard'

/** Tek bir kararın olay özetiyle karşılaştırmalı değerlendirmesi. */
export interface CorrelationVerdict {
  readonly documentId: string
  readonly relevant: boolean
  readonly reasoning?: string
}

/**
 * Değerlendirmeyi yapan arka uç. Model bağımsızdır, paket dışında uygulanır
 * (NER katmanındaki `NerBackend` deseninin aynısı).
 */
export interface CorrelationBackend {
  correlate(caseSummary: string, document: ResearchDocument): Promise<CorrelationVerdict>
}

/** Tek bir kararı özetleyen arka uç. */
export interface DocumentSummarizer {
  summarize(document: ResearchDocument): Promise<string>
}

export interface CorrelateOptions extends GuardOptions {
  /** İlk-K karar (`CAPABILITIES.md` A6). Aşan adaylar backend'e hiç gitmez. */
  readonly limit?: number
}

const DEFAULT_LIMIT = 10

/**
 * Olay özetini adaylarla K bağımsız kısa geçişte karşılaştırır.
 *
 * `caseSummary` kullanıcının dosyasından türetildiği için maskelenmemiş
 * kimlik verisi taşıyabilir; bu yüzden `search()` ile aynı kapıdan geçer
 * (M7.2/M7.3) — geçemezse hiçbir backend çağrısı yapılmaz.
 */
export async function correlateWithCase(
  caseSummary: string,
  documents: readonly ResearchDocument[],
  backend: CorrelationBackend,
  options: CorrelateOptions = {},
): Promise<readonly CorrelationVerdict[]> {
  assertMasked(caseSummary, options)

  const limit = options.limit ?? DEFAULT_LIMIT
  const candidates = documents.slice(0, limit)

  return Promise.all(candidates.map((document) => backend.correlate(caseSummary, document)))
}

/**
 * Tek kararı özetler. Karar metni kamuya açık içtihattır — kullanıcının
 * kişisel verisi değildir, bu yüzden maskeleme kapısından geçmesi gerekmez.
 */
export async function summarizeDocument(
  document: ResearchDocument,
  summarizer: DocumentSummarizer,
): Promise<string> {
  return summarizer.summarize(document)
}
