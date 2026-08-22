/**
 * Olayla ilişkilendirme — plan M7.6, `docs/CAPABILITIES.md` A6.
 *
 * "Kullanıcının olay özeti kısa (< 800 token); her aday karar AYRI AYRI olay
 * özetiyle tek pencerede değerlendirilir. İlk-K karar için K bağımsız kısa
 * geçiş."
 *
 * "Bağımsız" burada bir davranış kuralı değil, TİP DÜZEYİNDE zorlanan bir
 * sınırdır: `CorrelationBackend.correlate` imzası tek belge alır, aday
 * listesinin tamamını asla göremez. Bir aday hakkındaki karar diğer
 * adayların içeriğine erişemez — çünkü erişecek bir yol yoktur.
 */

import type { ResearchDocument } from './client'

export interface CorrelationVerdict {
  readonly relevant: boolean
  /** Kısa gerekçe; modelin serbest metni, opsiyonel. */
  readonly reasoning?: string
  readonly confidence?: number
}

export interface CorrelationResult extends CorrelationVerdict {
  readonly documentId: string
}

export interface CorrelationBackend {
  readonly id: string
  readonly runsLocally: true
  correlate(caseSummary: string, document: ResearchDocument): CorrelationVerdict
}

/** Model tabanlı uygulamalar için — çıkarım eşzamansızdır. */
export interface AsyncCorrelationBackend {
  readonly id: string
  readonly runsLocally: true
  correlate(caseSummary: string, document: ResearchDocument): Promise<CorrelationVerdict>
}

export interface CorrelateOptions {
  /** İlk-K karar; verilmezse tüm adaylar değerlendirilir. */
  readonly limit?: number
}

/**
 * İlk-K adayı, HER BİRİNİ kendi bağımsız geçişinde değerlendirir.
 *
 * `Promise.all` ile eşzamanlı koşar: hiçbir çağrı diğer adayın belgesini
 * ya da sonucunu görmez. Girdi sırası korunur.
 */
export async function correlateDocuments(
  caseSummary: string,
  documents: readonly ResearchDocument[],
  backend: CorrelationBackend | AsyncCorrelationBackend,
  options: CorrelateOptions = {},
): Promise<readonly CorrelationResult[]> {
  const limit = options.limit ?? documents.length
  const candidates = documents.slice(0, Math.max(0, limit))

  const verdicts = await Promise.all(
    candidates.map((document) => backend.correlate(caseSummary, document)),
  )

  return verdicts.map((verdict, index) => ({
    ...verdict,
    documentId: (candidates[index] as ResearchDocument).id,
  }))
}
