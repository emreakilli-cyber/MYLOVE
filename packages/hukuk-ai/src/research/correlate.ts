/**
 * Sonuç özetleme ve olayla ilişkilendirme — plan M7.6, `CAPABILITIES.md` A6.
 *
 * Bu adım ağa ÇIKMAZ: kararların/mevzuatın metni `ResearchClient`'tan zaten
 * elde edilmiştir (M7). Geriye kalan iş — özetleme ve olay ile ilişkilendirme —
 * cihaz içi modelin işidir; arayüz NER katmanındaki gibi (`mask/ner/types.ts`)
 * model bağımsızdır.
 *
 * A6 sözleşmesi: "İlk-K karar için K BAĞIMSIZ KISA GEÇİŞ; uzun bağlam yok."
 * Bu kural yorumla değil imzayla zorlanır: `CorrelationBackend.correlate` ve
 * `SummaryBackend.summarize` her çağrıda TEK belge görür, hiçbir zaman dizi
 * almaz. Çağıran taraf K belgeyi tek bağlamda birleştirip tek geçişte
 * göndermek isterse bunu tip düzeyinde yapamaz.
 */

import type { ResearchDocument } from './client'

export type Relevance = 'yüksek' | 'orta' | 'düşük'

export interface CaseCorrelation {
  readonly documentId: string
  readonly relevance: Relevance
  /** Tek cümlelik gerekçe — kullanıcı neden bu kararın önerildiğini görür. */
  readonly reason: string
}

export interface CorrelationBackend {
  readonly id: string
  /** Ağ yasağının tip düzeyindeki karşılığı (M3.6 ile aynı desen). */
  readonly runsLocally: true
  /**
   * `caseSummary` kullanıcının olay özetidir (< 800 token, A6), `document` ise
   * TEK aday karardır. Aynı anda iki karar birden bu imzaya sığmaz.
   */
  correlate(
    caseSummary: string,
    document: ResearchDocument,
  ): CaseCorrelation | Promise<CaseCorrelation>
}

export interface SummaryBackend {
  readonly id: string
  readonly runsLocally: true
  /** Tek karar özeti — tek/iki geçiş (A6). */
  summarize(document: ResearchDocument): string | Promise<string>
}

export interface DocumentSummary {
  readonly documentId: string
  readonly summary: string
}

/**
 * Her belgeyi bağımsız olarak özetler. Belgeler sırayla işlenir; hiçbir
 * çağrıda birden fazla belge backend'e verilmez.
 */
export async function summarizeResults(
  documents: readonly ResearchDocument[],
  backend: SummaryBackend,
): Promise<readonly DocumentSummary[]> {
  const summaries: DocumentSummary[] = []
  for (const document of documents) {
    summaries.push({ documentId: document.id, summary: await backend.summarize(document) })
  }
  return summaries
}

/**
 * İlk-K karar için K bağımsız kısa geçiş (A6). Girdi sırası korunur; çıktı
 * uzunluğu her zaman `documents.length`'e eşittir.
 */
export async function correlateResults(
  caseSummary: string,
  documents: readonly ResearchDocument[],
  backend: CorrelationBackend,
): Promise<readonly CaseCorrelation[]> {
  const results: CaseCorrelation[] = []
  for (const document of documents) {
    results.push(await backend.correlate(caseSummary, document))
  }
  return results
}
