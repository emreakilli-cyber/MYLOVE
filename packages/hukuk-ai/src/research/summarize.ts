/**
 * Sonuç özetleme ve olayla ilişkilendirme — plan M7.6.
 *
 * `CAPABILITIES.md` A6: özetleme tek karar için tek/iki geçiş; ilişkilendirme
 * ilk-K aday karar için **K bağımsız kısa geçiş** — hiçbir geçiş diğer
 * adayları görmez, uzun bağlam yok. Kullanıcının olay özeti kısadır
 * (< 800 token ≈ `CASE_SUMMARY_CHAR_BUDGET` karakter).
 *
 * Bu modül ağa çıkmaz (M7.5 testi doğrular). Özetleme ve ilişkilendirme
 * cihaz içi modelle yapılır; model burada uygulanmaz, `SummaryBackend` /
 * `CorrelationBackend` olarak dışarıdan verilir — tıpkı NER katmanındaki
 * `NerBackend` gibi.
 */

import type { ResearchDocument } from './client'

export interface SummaryBackend {
  summarize(excerpt: string): Promise<string> | string
}

export interface CorrelationScore {
  readonly relevant: boolean
  readonly rationale: string
}

export interface CorrelationBackend {
  correlate(caseSummary: string, documentExcerpt: string): Promise<CorrelationScore> | CorrelationScore
}

export interface DocumentSummary {
  readonly document: ResearchDocument
  readonly summary: string
}

export interface DocumentCorrelation {
  readonly document: ResearchDocument
  readonly score: CorrelationScore
}

/** Olay özeti bağlam bütçesi (`CAPABILITIES.md` A6): ~800 token ≈ 3.200 karakter (~4 karakter/token). */
export const CASE_SUMMARY_CHAR_BUDGET = 3200

export class CaseSummaryTooLongError extends Error {
  override readonly name = 'CaseSummaryTooLongError'
  readonly length: number

  constructor(length: number) {
    super(
      `Olay özeti bağlam bütçesini aşıyor (${length} karakter > ${CASE_SUMMARY_CHAR_BUDGET}). ` +
        'Özeti kısaltın; ilişkilendirme tek pencerede çalışmak zorundadır (CAPABILITIES.md A6).',
    )
    this.length = length
  }
}

/** Tek bir kararı özetler — kararın kendi metni dışında bağlam görmez. */
export async function summarizeDocument(
  document: ResearchDocument,
  backend: SummaryBackend,
): Promise<string> {
  return backend.summarize(document.excerpt)
}

/**
 * Birden çok kararı özetler. Her belge **bağımsız** özetlenir: biri
 * diğerinin bağlamını görmez, aralarında hiçbir paylaşılan pencere yoktur.
 */
export async function summarizeDocuments(
  documents: readonly ResearchDocument[],
  backend: SummaryBackend,
): Promise<readonly DocumentSummary[]> {
  return Promise.all(
    documents.map(async (document) => ({
      document,
      summary: await summarizeDocument(document, backend),
    })),
  )
}

/**
 * İlk-K aday kararı kullanıcının olay özetiyle ilişkilendirir.
 *
 * Her karar **kendi bağımsız geçişinde** değerlendirilir: backend'e yalnız
 * `(caseSummary, tek belgenin özeti)` çifti gider; diğer adaylar hiçbir zaman
 * aynı pencerede görünmez. K karar için K çağrı demektir — uzun bağlam yerine
 * paralel kısa geçişler (`CAPABILITIES.md` A6).
 */
export async function correlateDocuments(
  caseSummary: string,
  documents: readonly ResearchDocument[],
  backend: CorrelationBackend,
): Promise<readonly DocumentCorrelation[]> {
  if (caseSummary.length > CASE_SUMMARY_CHAR_BUDGET) {
    throw new CaseSummaryTooLongError(caseSummary.length)
  }

  return Promise.all(
    documents.map(async (document) => ({
      document,
      score: await backend.correlate(caseSummary, document.excerpt),
    })),
  )
}
