/**
 * Karar özetleme ve olayla ilişkilendirme — plan M7.6, `CAPABILITIES.md` A6.
 *
 * A6'nın kuralı: "Her aday karar AYRI AYRI olay özetiyle tek pencerede
 * değerlendirilir. İlk-K karar için K bağımsız kısa geçiş." Bu dosya o kuralı
 * kod düzeyinde zorlar — `relateDocumentsToCase` tek çağrıda hiçbir zaman
 * birden fazla kararın metnini aynı bağlama sokmaz; her karar kendi backend
 * çağrısını alır.
 *
 * Bu katman ağa çıkmaz. `ResearchClient.search` sonucu zaten getirmiştir;
 * burada yalnız cihaz içi özetleme/ilişkilendirme modeli çalışır — NER
 * katmanındaki (`mask/ner/types.ts`) model-bağımsız arayüz deseniyle aynı
 * şekilde takılabilir.
 */

import type { ResearchDocument } from './client'

/** A6: "kullanıcının olay özeti kısa (< 800 token)" — pencere bütçesi budur. */
export const CASE_SUMMARY_TOKEN_BUDGET = 800

/** A6: "tek karar tipik 2.000–6.000 token" — üst sınır budur. */
export const DOCUMENT_TOKEN_BUDGET = 6000

/** A6: "İlk-K karar" — K'nın varsayılan değeri. */
export const DEFAULT_RELATE_LIMIT = 10

/**
 * Kaba token tahmini (~4 karakter/token). Kesin ölçüm değildir; yalnız bütçe
 * uyarısı üretmek için kullanılır — SPEC'in dışındadır.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export class CaseSummaryTooLongError extends Error {
  override readonly name = 'CaseSummaryTooLongError'
  readonly estimatedTokens: number

  constructor(estimatedTokens: number) {
    super(
      `Olay özeti çok uzun (~${estimatedTokens} token tahmini, bütçe ` +
        `${CASE_SUMMARY_TOKEN_BUDGET}). İlişkilendirme tek pencerede çalışmak ` +
        'zorundadır (CAPABILITIES.md A6).',
    )
    this.estimatedTokens = estimatedTokens
  }
}

export interface DocumentSummary {
  readonly documentId: string
  readonly summary: string
}

export interface CaseRelevance {
  readonly documentId: string
  readonly relevant: boolean
  readonly rationale: string
}

/**
 * Cihaz içi özetleme/ilişkilendirme modeli. Fine-tuning ile başlanmaz
 * (M8.6 kararı); bu arayüz o kararla tutarlı — model takılabilir, paket
 * hiçbir somut modele bağlı değildir.
 */
export interface SummaryBackend {
  /** Tek kararı özetler — diğer kararlardan bağımsız, tek/iki geçiş. */
  summarizeDocument(document: ResearchDocument): DocumentSummary | Promise<DocumentSummary>
  /** Tek kararı olay özetiyle karşılaştırır — yalnız bu ikisi bağlamdadır. */
  relateToCase(
    document: ResearchDocument,
    caseSummary: string,
  ): CaseRelevance | Promise<CaseRelevance>
}

export interface RelateOptions {
  /** İlk-K karar; kalanı hiç işlenmez. Varsayılan `DEFAULT_RELATE_LIMIT`. */
  readonly limit?: number
}

/** Tek kararı özetler. `summarizeDocuments` ile birebir aynı yolu kullanır. */
export async function summarizeDocument(
  document: ResearchDocument,
  backend: SummaryBackend,
): Promise<DocumentSummary> {
  return backend.summarizeDocument(document)
}

/** İlk-K aday kararın her birini, diğerlerinden bağımsız olarak özetler. */
export async function summarizeDocuments(
  documents: readonly ResearchDocument[],
  backend: SummaryBackend,
  options: RelateOptions = {},
): Promise<readonly DocumentSummary[]> {
  const limit = options.limit ?? DEFAULT_RELATE_LIMIT
  const results: DocumentSummary[] = []
  for (const document of documents.slice(0, limit)) {
    results.push(await summarizeDocument(document, backend))
  }
  return results
}

function assertCaseSummaryFits(caseSummary: string): void {
  const estimated = estimateTokens(caseSummary)
  if (estimated > CASE_SUMMARY_TOKEN_BUDGET) throw new CaseSummaryTooLongError(estimated)
}

/**
 * İlk-K aday kararı olay özetiyle ilişkilendirir.
 *
 * Her karar KENDİ ÇAĞRISINDA değerlendirilir — `backend.relateToCase` her
 * seferinde tek bir `ResearchDocument` alır, önceki kararların metni bir
 * sonrakinin çağrısına hiçbir biçimde taşınmaz. Bu, uzun bağlam gerektirmeden
 * K bağımsız kısa geçiş kuralını sağlar (M7.6).
 */
export async function relateDocumentsToCase(
  documents: readonly ResearchDocument[],
  caseSummary: string,
  backend: SummaryBackend,
  options: RelateOptions = {},
): Promise<readonly CaseRelevance[]> {
  assertCaseSummaryFits(caseSummary)

  const limit = options.limit ?? DEFAULT_RELATE_LIMIT
  const candidates = documents.slice(0, limit)

  const results: CaseRelevance[] = []
  for (const document of candidates) {
    results.push(await backend.relateToCase(document, caseSummary))
  }
  return results
}
