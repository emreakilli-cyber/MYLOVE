/**
 * Aşamalı üretim — plan M8.7, `CAPABILITIES.md` A13.
 *
 * Uzun layiha üretimi üç aşamaya bölünür: **iskelet → bölüm bölüm → tutarlılık
 * geçişi**. Bu dosya modeli çalıştırmaz — tıpkı araştırma katmanındaki
 * `ResearchTransport` (M7.1) ve özetleme/ilişkilendirmedeki `SummaryBackend` /
 * `CorrelationBackend` (M7.6) gibi, model çağrısı `OutlineBackend` /
 * `SectionBackend` / `ConsistencyBackend` arayüzleriyle dışarıdan verilir.
 *
 * Üç aşamanın bağlam ayrımı **tip sisteminde** kurulur, yorum satırında değil:
 * - `generateSections` her bölümü backend'e AYRI AYRI verir; bir çağrı diğer
 *   bölümlerin tam metnini asla görmez (K bağımsız kısa geçiş, M7.6 ile aynı desen).
 * - `checkDocumentConsistency` yalnız `SectionSummary[]` alır — imzada bölümün
 *   TAM METNİ yer almaz. Tutarlılık geçişi özetler üzerinde çalışır (A13.3),
 *   tam metni kaçak yoldan bağlama sokamaz.
 *
 * Bu katman internete ÇIKMAZ (M8.1). Model cihaz içi çalışır; kullanıcı
 * verisinin ağa gitme koşulu (A3 maskeleme) burada geçerli değildir çünkü veri
 * zaten cihazdan çıkmıyor.
 */

export interface OutlineSection {
  readonly id: string
  readonly heading: string
  /** Bu bölüme atanmış olgu/talep referansları (A10 olgu kaydı biçiminde, yalnız kimlik). */
  readonly factRefs: readonly string[]
}

export interface DocumentOutline {
  readonly documentType: string
  readonly sections: readonly OutlineSection[]
}

export interface OutlineInput {
  readonly documentType: string
  /** Kısa olgu/talep özetleri — tam dosya değil (A13.1: ~500 token). */
  readonly facts: readonly string[]
}

export interface OutlineBackend {
  generateOutline(input: OutlineInput): Promise<DocumentOutline> | DocumentOutline
}

export async function generateOutline(
  input: OutlineInput,
  backend: OutlineBackend,
): Promise<DocumentOutline> {
  return backend.generateOutline(input)
}

export interface SectionContext {
  readonly fewShotExamples?: readonly { readonly id: string; readonly text: string }[]
}

export interface SectionGenerationInput {
  readonly outline: DocumentOutline
  readonly section: OutlineSection
  readonly context: SectionContext
}

export interface SectionBackend {
  generateSection(input: SectionGenerationInput): Promise<string> | string
}

export interface GeneratedSection {
  readonly sectionId: string
  readonly heading: string
  readonly text: string
}

/**
 * Her bölümü bağımsız üretir (A13.2). Backend'e her çağrıda yalnız TEK bölüm
 * ve paylaşılan bağlam (iskelet + few-shot) verilir — diğer bölümlerin üretilmiş
 * metni asla iletilmez. Kesintili kullanım: çağıran taraf her sonucu ayrı ayrı
 * kullanıcıya gösterip onaylatabilir; bu fonksiyon hepsini tek seferde üretir,
 * ama her `GeneratedSection` bağımsız ve kendi başına anlamlıdır.
 */
export async function generateSections(
  outline: DocumentOutline,
  context: SectionContext,
  backend: SectionBackend,
): Promise<readonly GeneratedSection[]> {
  return Promise.all(
    outline.sections.map(async (section) => ({
      sectionId: section.id,
      heading: section.heading,
      text: await backend.generateSection({ outline, section, context }),
    })),
  )
}

export interface SectionSummary {
  readonly sectionId: string
  readonly heading: string
  readonly summary: string
}

export interface ConsistencyIssue {
  readonly sectionIds: readonly string[]
  readonly description: string
}

/** Yalnız ÖZETLERİ görür — tam metin bu arayüzden asla geçemez (A13.3). */
export interface ConsistencyBackend {
  checkConsistency(
    summaries: readonly SectionSummary[],
  ): Promise<readonly ConsistencyIssue[]> | readonly ConsistencyIssue[]
}

export async function checkDocumentConsistency(
  summaries: readonly SectionSummary[],
  backend: ConsistencyBackend,
): Promise<readonly ConsistencyIssue[]> {
  return backend.checkConsistency(summaries)
}

const NUMBERING_PREFIX = /^(\d+(?:\.\d+)*)\.\s*/

/**
 * Numaralandırma tutarlılığı — deterministik denetim (A13.3: "numaralandırma
 * ... deterministik denetlenir", model gerektirmez). Yalnız noktalı Arap
 * rakamı biçimini (`1.`, `1.2.`) denetler: üst seviye sıra numaraları 1'den
 * başlayıp artmalı. Başka bir şema kullanılıyorsa (Romen, harf) bu denetim
 * sessizce atlar — yanlış pozitif üretmez.
 */
export function checkNumberingConsistency(
  sections: readonly GeneratedSection[],
): readonly ConsistencyIssue[] {
  const numbered = sections
    .map((section) => ({ section, match: NUMBERING_PREFIX.exec(section.heading) }))
    .filter((entry): entry is { section: GeneratedSection; match: RegExpExecArray } =>
      entry.match !== null,
    )

  if (numbered.length === 0) return []

  const issues: ConsistencyIssue[] = []
  let expectedTop = 1
  for (const { section, match } of numbered) {
    const topLevel = Number.parseInt((match[1] ?? '').split('.')[0] ?? '', 10)
    if (Number.isNaN(topLevel)) continue

    if (topLevel !== expectedTop) {
      issues.push({
        sectionIds: [section.sectionId],
        description: `"${section.heading}" numarası ${expectedTop} beklenirken ${topLevel} yazılmış.`,
      })
    }
    expectedTop = topLevel + 1
  }
  return issues
}
