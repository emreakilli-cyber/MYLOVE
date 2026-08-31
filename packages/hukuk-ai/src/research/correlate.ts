/**
 * Sonuç özetleme ve olayla ilişkilendirme — plan M7.6, `CAPABILITIES.md` A6.
 *
 * Arama sonucu gelen kararlar burada (1) tek tek özetlenir ve (2) kullanıcının
 * olay özetiyle AYRI AYRI karşılaştırılır. İkisi de cihaz içi modelle çalışır;
 * ağa çıkmazlar. `SummaryBackend`/`CorrelationBackend` bunu `runsLocally: true`
 * ile tip düzeyinde iddia eder — tıpkı `NerBackend` gibi (M3.6 ile aynı desen).
 *
 * A6'nın iddiası şudur: "İlk-K karar için K BAĞIMSIZ kısa geçiş, uzun bağlam
 * yok." Bu bir stil tercihi değil, mimari bir garantidir: `correlateWithEvent`
 * her adaya TEK belge + olay özeti verir. `CorrelationBackend.evaluate` imzası
 * diğer adayları veya önceki sonuçları hiç görmez — dolayısıyla "hepsini aynı
 * pencerede değerlendir" yolu koda hiç yazılamaz.
 */

import { estimateTokens } from '../shared/tokenEstimate'
import type { ResearchDocument } from './client'

/** A6 — "kullanıcının olay özeti kısa (< 800 token)". */
export const MAX_EVENT_SUMMARY_TOKENS = 800

/** A6 — "tek karar tipik 2.000–6.000 token"; üst sınır alınır. */
export const MAX_DOCUMENT_TOKENS_FOR_SUMMARY = 6000

/** A6 — "ilk-K karar" için varsayılan K. */
export const DEFAULT_CORRELATION_LIMIT = 10

export class EventSummaryTooLongError extends Error {
  override readonly name = 'EventSummaryTooLongError'
  readonly estimatedTokens: number
  readonly limit: number

  constructor(estimatedTokens: number, limit: number) {
    super(
      `Olay özeti çok uzun (~${estimatedTokens} token, sınır ~${limit}). ` +
        'CAPABILITIES.md A6: olay özeti kısa tutulmalı, tek pencereye sığmalı.',
    )
    this.estimatedTokens = estimatedTokens
    this.limit = limit
  }
}

export class DocumentTooLongForSummaryError extends Error {
  override readonly name = 'DocumentTooLongForSummaryError'
  readonly documentId: string
  readonly estimatedTokens: number
  readonly limit: number

  constructor(documentId: string, estimatedTokens: number, limit: number) {
    super(
      `Belge özetleme için çok uzun (id=${documentId}, ~${estimatedTokens} token, sınır ~${limit}). ` +
        'Bölüm bölüm özetleme A5 kalıbına girer, bu fonksiyonun kapsamı dışındadır.',
    )
    this.documentId = documentId
    this.estimatedTokens = estimatedTokens
    this.limit = limit
  }
}

/** Tek bir kararı özetleyen cihaz içi model arayüzü. */
export interface SummaryBackend {
  readonly id: string
  /** Ağ yasağının tip düzeyindeki karşılığı — bkz. `NerBackend` (M3.6). */
  readonly runsLocally: true
  summarize(document: ResearchDocument): Promise<string> | string
}

export interface DocumentSummary {
  readonly documentId: string
  readonly summary: string
}

/**
 * Tek bir kararı özetler. Girdi bütçeyi aşıyorsa özetlemeden ÖNCE hata verir
 * — sessizce kırpıp yarım veya yanıltıcı özet üretmez (SPEC'teki "sessiz veri
 * kaybı yoktur" ilkesiyle aynı ruh, bkz. unmask §5.1).
 */
export async function summarizeDocument(
  document: ResearchDocument,
  backend: SummaryBackend,
): Promise<DocumentSummary> {
  const estimated = estimateTokens(document.excerpt)
  if (estimated > MAX_DOCUMENT_TOKENS_FOR_SUMMARY) {
    throw new DocumentTooLongForSummaryError(document.id, estimated, MAX_DOCUMENT_TOKENS_FOR_SUMMARY)
  }
  return { documentId: document.id, summary: await backend.summarize(document) }
}

/**
 * Birden çok kararı özetler. Her belge KENDİ tek geçişinde işlenir —
 * `summarizeDocument` her çağrıda yalnız bir `ResearchDocument` görür, diğer
 * belgeler asla aynı bağlama girmez.
 */
export async function summarizeDocuments(
  documents: readonly ResearchDocument[],
  backend: SummaryBackend,
): Promise<readonly DocumentSummary[]> {
  return Promise.all(documents.map((document) => summarizeDocument(document, backend)))
}

export interface CorrelationVerdict {
  readonly documentId: string
  readonly relevant: boolean
  readonly rationale: string
}

export interface CorrelationBackend {
  readonly id: string
  /** Ağ yasağının tip düzeyindeki karşılığı — bkz. `NerBackend` (M3.6). */
  readonly runsLocally: true
  /**
   * TEK belge + olay özeti alır. Diğer adaylar veya önceki sonuçlar asla
   * parametre olarak verilmez — bağımsızlık burada, tip imzasında zorlanır.
   */
  evaluate(
    eventSummary: string,
    document: ResearchDocument,
  ): Promise<CorrelationVerdict> | CorrelationVerdict
}

export interface CorrelateOptions {
  /** İlk-K sınırı (A6). Varsayılan `DEFAULT_CORRELATION_LIMIT`. */
  readonly limit?: number
}

export interface CorrelationBatchResult {
  readonly verdicts: readonly CorrelationVerdict[]
  /** Kaç aday bağımsız geçişte değerlendirildi ("ilk-K"). */
  readonly evaluatedCount: number
  /** Sınır nedeniyle değerlendirilmeyen aday sayısı — sessizce yutulmaz, sayılır. */
  readonly skippedCount: number
}

/**
 * `CAPABILITIES.md` A6 — "İlk-K karar için K bağımsız kısa geçiş."
 *
 * Her belge, olay özetiyle TEK BAŞINA değerlendirilir: `backend.evaluate`
 * yalnız bir belge alır, bu da uzun bağlamı mimari olarak imkânsız kılar.
 * Geçişler birbirinden bağımsız olduğu için eşzamanlı çalıştırılır — sıra
 * sonucu etkilemez.
 */
export async function correlateWithEvent(
  eventSummary: string,
  documents: readonly ResearchDocument[],
  backend: CorrelationBackend,
  options: CorrelateOptions = {},
): Promise<CorrelationBatchResult> {
  const estimated = estimateTokens(eventSummary)
  if (estimated > MAX_EVENT_SUMMARY_TOKENS) {
    throw new EventSummaryTooLongError(estimated, MAX_EVENT_SUMMARY_TOKENS)
  }

  const limit = options.limit ?? DEFAULT_CORRELATION_LIMIT
  const candidates = documents.slice(0, limit)

  const verdicts = await Promise.all(
    candidates.map((document) => backend.evaluate(eventSummary, document)),
  )

  return {
    verdicts,
    evaluatedCount: candidates.length,
    skippedCount: documents.length - candidates.length,
  }
}
