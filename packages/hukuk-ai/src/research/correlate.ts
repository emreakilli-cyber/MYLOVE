/**
 * Sonuç özetleme ve olayla ilişkilendirme — plan M7.6, `docs/CAPABILITIES.md` A6.
 *
 * Arama ağa çıkar (A6, `client.ts`); özetleme ve ilişkilendirme çıkmaz — ikisi
 * de cihaz içi model işidir (A5/A8 ile aynı sınıf). Bu yüzden burada `MaskGuard`
 * yok; ağ yasağı `research.test.ts`teki dosya taramasıyla zaten doğrulanıyor.
 *
 * K BAĞIMSIZ KISA GEÇİŞ: backend arayüzleri bir çağrıda yalnız TEK belge alır.
 * Aday kararları tek pencerede birleştirip modele vermenin API'de bir yolu
 * yoktur — "uzun bağlam yok" kuralı burada imza düzeyinde zorlanır, yorum
 * satırına bırakılmaz. Çağrılar sırayla yapılır: cihazda tek bir model örneği
 * vardır (§0 cihaz bütçesi), eşzamanlı K çağrı aynı kaynağı paylaşıp birbirini
 * yavaşlatırdı.
 */

import type { ResearchDocument } from './client'

export interface SummaryBackend {
  readonly id: string
  readonly runsLocally: true
  summarize(document: ResearchDocument): string | Promise<string>
}

export interface DocumentSummary {
  readonly documentId: string
  readonly summary: string
}

export interface DocumentCorrelation {
  readonly documentId: string
  /** 0 (olayla ilgisiz) – 1 (doğrudan emsal) */
  readonly relevance: number
  /** Kısa gerekçe — bu karar olayla neden ilişkili/ilişkisiz görüldü */
  readonly rationale: string
}

export interface CorrelationBackend {
  readonly id: string
  readonly runsLocally: true
  correlate(
    caseSummary: string,
    document: ResearchDocument,
  ): DocumentCorrelation | Promise<DocumentCorrelation>
}

export interface TopKOptions {
  /** İlk-K karar (A6). Aşılırsa fazlası sessizce atılır, `note` fazlayı bildirir. */
  readonly limit?: number
}

export interface TopKResult<T> {
  readonly results: readonly T[]
  /** Toplam aday sayısı K'yı aştıysa bilgi notu; aşmadıysa `undefined`. */
  readonly note?: string
}

const DEFAULT_LIMIT = 10

function selectTopK<T>(items: readonly T[], limit: number): TopKResult<T> {
  if (items.length <= limit) return { results: items }
  return {
    results: items.slice(0, limit),
    note: `İlk ${limit} sonuç değerlendirildi, ${items.length - limit} sonuç elendi.`,
  }
}

/** Her belgeyi TEK BAŞINA özetler (A6: tek karar, tek/iki geçiş). */
export async function summarizeResults(
  documents: readonly ResearchDocument[],
  backend: SummaryBackend,
  options: TopKOptions = {},
): Promise<TopKResult<DocumentSummary>> {
  const { results: selected, note } = selectTopK(documents, options.limit ?? DEFAULT_LIMIT)

  const summaries: DocumentSummary[] = []
  for (const document of selected) {
    summaries.push({ documentId: document.id, summary: await backend.summarize(document) })
  }

  return note ? { results: summaries, note } : { results: summaries }
}

/**
 * Olay özetini her aday kararla AYRI AYRI, bağımsız geçişlerde ilişkilendirir.
 *
 * `caseSummary` maskelenmiş olmalıdır — bu fonksiyon ağa çıkmadığı için
 * `assertMasked` çağırmaz, ama olay özeti çağrıdan önce zaten maskelenmiş
 * olarak akışa girer (araştırma sorgusuyla aynı metin).
 */
export async function correlateResults(
  caseSummary: string,
  documents: readonly ResearchDocument[],
  backend: CorrelationBackend,
  options: TopKOptions = {},
): Promise<TopKResult<DocumentCorrelation>> {
  const { results: selected, note } = selectTopK(documents, options.limit ?? DEFAULT_LIMIT)

  const correlations: DocumentCorrelation[] = []
  for (const document of selected) {
    correlations.push(await backend.correlate(caseSummary, document))
  }

  return note ? { results: correlations, note } : { results: correlations }
}
