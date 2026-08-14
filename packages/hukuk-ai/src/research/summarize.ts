/**
 * Sonuç özetleme ve olayla ilişkilendirme — plan M7.6.
 *
 * `CAPABILITIES.md` A6: "Özetleme — tek karar tipik 2.000–6.000 token, tek/iki
 * geçiş. İlişkilendirme — kullanıcının olay özeti kısa (< 800 token); her aday
 * karar AYRI AYRI olay özetiyle tek pencerede değerlendirilir. İlk-K karar için
 * K bağımsız kısa geçiş."
 *
 * Bu dosya modeli kendisi çalıştırmaz — M7.1'deki `ResearchTransport` deseniyle
 * aynı yoldan, `SummaryBackend` / `CorrelationBackend` dışarıdan verilir. Kritik
 * olan şey model değil, **şekil**: `correlateWithCase` her adayı backend'e TEK
 * BAŞINA verir — imza bir belge alır, dizi almaz. Böylece "uzun bağlam yok"
 * kuralı bir yorum değil, tip sisteminin kendisidir; K bağımsız geçiş çağıran
 * tarafın disiplinine değil buradaki döngüye bağlıdır.
 *
 * Olay özeti kullanıcı verisi taşıdığı için M7.2'deki kapıdan geçer
 * (`assertMasked`) — tıpkı arama sorgusu gibi.
 */

import { assertMasked, type GuardOptions } from './guard'
import type { ResearchDocument } from './client'

export interface DocumentSummary {
  readonly documentId: string
  readonly summary: string
}

/** Tek bir kararı özetler. Diğer belgelerin bağlamı hiç görülmez. */
export interface SummaryBackend {
  summarize(document: ResearchDocument): Promise<string> | string
}

export interface CorrelationVerdict {
  /** Aday, kullanıcının olayıyla ilgili mi? */
  readonly relevant: boolean
  /** Kısa gerekçe — kullanıcıya gösterilir. */
  readonly rationale: string
  /** 0..1. */
  readonly confidence: number
}

export interface CorrelationResult extends CorrelationVerdict {
  readonly documentId: string
}

/**
 * Bir olay özetini TEK bir aday kararla karşılaştırır. İmza bilerek dizi
 * almaz: `correlateWithCase` bunu her aday için ayrı ayrı çağırır, böylece
 * bir çağrının içinden başka bir adayın metnine erişilemez.
 */
export interface CorrelationBackend {
  correlate(caseSummary: string, document: ResearchDocument): Promise<CorrelationVerdict> | CorrelationVerdict
}

/**
 * `documents` listesindeki her kararı bağımsız olarak özetler (M7.6, A6).
 * Belgeler arası bağlam paylaşılmaz — her çağrı yalnız kendi belgesini görür.
 */
export async function summarizeDocuments(
  documents: readonly ResearchDocument[],
  backend: SummaryBackend,
): Promise<readonly DocumentSummary[]> {
  return Promise.all(
    documents.map(async (document) => ({
      documentId: document.id,
      summary: await backend.summarize(document),
    })),
  )
}

export interface CorrelateOptions extends GuardOptions {
  /**
   * K — değerlendirilecek aday sayısı üst sınırı. Verilmezse listenin tamamı
   * kullanılır (arama zaten `ResearchQuery.limit` ile üst sınır koymuş olmalı).
   */
  readonly limit?: number
}

/**
 * Olay özetini ilk-K aday kararla ilişkilendirir: K bağımsız kısa geçiş.
 *
 * Sırasıyla değil **eşzamanlı** çalışır (`Promise.all`) — bu, "bağımsız"
 * olduğunu hem semantik hem performans olarak garanti eder: bir çağrının
 * sonucu bir sonrakinin girdisine hiçbir şekilde karışamaz.
 *
 * `caseSummary` maskelenmemişse `UnmaskedContentError` fırlatır (M7.2 ile
 * aynı kapı) — olay özeti de kullanıcı verisidir, araştırma sorgusundan farksız.
 */
export async function correlateWithCase(
  caseSummary: string,
  documents: readonly ResearchDocument[],
  backend: CorrelationBackend,
  options: CorrelateOptions = {},
): Promise<readonly CorrelationResult[]> {
  assertMasked(caseSummary, options)

  const candidates = options.limit === undefined ? documents : documents.slice(0, options.limit)

  return Promise.all(
    candidates.map(async (document) => {
      const verdict = await backend.correlate(caseSummary, document)
      return { documentId: document.id, ...verdict }
    }),
  )
}
