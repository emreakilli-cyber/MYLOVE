/**
 * Karar özetleme — plan M7.6, `docs/CAPABILITIES.md` A6.
 *
 * "Tek karar tipik 2.000–6.000 token, tek/iki geçiş." Özetleyici model
 * bağımsızdır (NER'deki `NerBackend` deseninin aynısı, M3.2): cihazda model
 * yoksa çıkartmalı (extractive) varsayılan uygulama koşar, model varsa aynı
 * arayüzü uygulayan bir arka uç takılır.
 *
 * SÖZLEŞME: `runsLocally` sabiti `true` olmayan bir uygulama derlenmez — M3.6
 * ile aynı tip düzeyinde ağ yasağı. Bu katman zaten araştırma sorgusundan
 * SONRA, elde edilmiş kararlar üzerinde çalışır; ağa yeniden çıkmaz.
 */

import type { ResearchDocument } from './client'

export interface SummaryBackend {
  readonly id: string
  readonly runsLocally: true
  summarize(document: ResearchDocument): string
}

/** Model tabanlı uygulamalar için — çıkarım eşzamansızdır. */
export interface AsyncSummaryBackend {
  readonly id: string
  readonly runsLocally: true
  summarize(document: ResearchDocument): Promise<string>
}

export interface DocumentSummary {
  readonly documentId: string
  readonly summary: string
}

export interface ExtractiveSummaryOptions {
  /** Karakter sınırı; varsayılan 400 (~ birkaç yüz token altı, tek geçiş). */
  readonly maxLength?: number
}

/**
 * Modelsiz varsayılan uygulama (M3.3 ile aynı ilke): parçayı (`excerpt`)
 * cümle sınırında keser. Model yokken de sistem çalışır.
 */
export function createExtractiveSummaryBackend(
  options: ExtractiveSummaryOptions = {},
): SummaryBackend {
  const maxLength = options.maxLength ?? 400

  return {
    id: 'extractive-default',
    runsLocally: true,
    summarize(document) {
      const excerpt = document.excerpt.trim()
      if (excerpt.length <= maxLength) return excerpt

      const truncated = excerpt.slice(0, maxLength)
      const lastSentenceEnd = Math.max(
        truncated.lastIndexOf('. '),
        truncated.lastIndexOf('.\n'),
      )
      const cut = lastSentenceEnd > maxLength * 0.4 ? lastSentenceEnd + 1 : maxLength
      return `${truncated.slice(0, cut).trimEnd()}…`
    },
  }
}

/**
 * Her karar KENDİ geçişinde özetlenir — biri diğerinin bağlamına karışmaz.
 * `Promise.all` ile bağımsız koşar; sıra girdi sırasıyla birebir korunur.
 */
export async function summarizeDocuments(
  documents: readonly ResearchDocument[],
  backend: SummaryBackend | AsyncSummaryBackend = createExtractiveSummaryBackend(),
): Promise<readonly DocumentSummary[]> {
  return Promise.all(
    documents.map(async (document) => ({
      documentId: document.id,
      summary: await backend.summarize(document),
    })),
  )
}
