/**
 * Aşamalı layiha/dilekçe üretimi — plan M8.7, `CAPABILITIES.md` A13.
 *
 * A13'ün üç aşaması birebir kodlanmıştır:
 *   1. İskelet — `backend.planSkeleton` başlık planını üretir (~500 token).
 *   2. Bölüm bölüm üretim — her bölüm KENDİ ÇAĞRISINDA, iskelet + üslup
 *      profili + few-shot örnekleriyle ≤ `SECTION_TOKEN_BUDGET` penceresinde
 *      yazılır (A9/A13). Bir bölümün tam metni bir SONRAKİ bölümün çağrısına
 *      hiç girmez.
 *   3. Tutarlılık geçişi — bölümlerin TAM METNİ değil, `summary` alanları
 *      (A13: "bölümlerin özetleri üzerinde yapılır") `reviewConsistency`'ye
 *      verilir. Bu, tip düzeyinde zorlanır: `reviewConsistency` imzası
 *      `SectionSummary[]` alır, `DraftSection[]` değil — tam metni fiziken
 *      geçiremezsiniz.
 *
 * Model burada da takılabilir (`DraftBackend`) — M8.6 kararıyla tutarlı,
 * fine-tuning ile başlanmaz; üretim önce iskelet+üslup+few-shot ile denenir.
 */

import type { PetitionStructure } from './structure'
import type { FewShotSelection } from './fewShot'
import type { StyleProfile } from './styleProfile'

/** A9/A13: bölüm başına pencere bütçesi. Girdi (few-shot + olgu) bunu aşmamalı. */
export const SECTION_TOKEN_BUDGET = 2000

/** A13: "12 özet ≈ 1.500 token, tek pencere" — tutarlılık geçişinin bütçesi. */
export const CONSISTENCY_SUMMARY_BUDGET = 2000

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export interface SectionPlan {
  readonly heading: string
  readonly numbering?: string
  /** A10 olgu kayıtlarına referans — bu paket olgu şemasının SAHİBİ değildir, opak id taşır. */
  readonly factRefs: readonly string[]
}

export interface DraftSkeleton {
  readonly sections: readonly SectionPlan[]
}

export interface DraftSection {
  readonly heading: string
  readonly text: string
  /** Tutarlılık geçişinde kullanılan kısa özet — tam metin DEĞİL. */
  readonly summary: string
}

export interface SectionSummary {
  readonly heading: string
  readonly summary: string
}

export interface ConsistencyIssue {
  readonly description: string
  readonly headings: readonly string[]
}

export interface ConsistencyReport {
  readonly issues: readonly ConsistencyIssue[]
}

export interface DraftInput {
  /** Masaüstü/telefon fark etmez — çağıranın sorumluluğu, bu katman ağa çıkmaz. */
  readonly caseSummary: string
  readonly structure?: PetitionStructure
}

export interface SectionContext {
  readonly styleProfile?: StyleProfile
  readonly fewShotExamples?: readonly FewShotSelection[]
}

export interface DraftBackend {
  /** Aşama 1 — başlık planı. */
  planSkeleton(input: DraftInput): DraftSkeleton | Promise<DraftSkeleton>
  /** Aşama 2 — tek bölüm, diğer bölümlerden bağımsız. */
  writeSection(section: SectionPlan, context: SectionContext): DraftSection | Promise<DraftSection>
  /** Aşama 3 — yalnız özetler üzerinde çalışır (bkz. dosya başı açıklama). */
  reviewConsistency(
    summaries: readonly SectionSummary[],
  ): ConsistencyReport | Promise<ConsistencyReport>
}

export class ConsistencySummaryTooLongError extends Error {
  override readonly name = 'ConsistencySummaryTooLongError'
  readonly estimatedTokens: number

  constructor(estimatedTokens: number) {
    super(
      `Bölüm özetlerinin toplamı çok uzun (~${estimatedTokens} token tahmini, bütçe ` +
        `${CONSISTENCY_SUMMARY_BUDGET}). Tutarlılık geçişi tek pencerede çalışmak ` +
        'zorundadır (CAPABILITIES.md A13).',
    )
    this.estimatedTokens = estimatedTokens
  }
}

export interface DraftResult {
  readonly skeleton: DraftSkeleton
  readonly sections: readonly DraftSection[]
  readonly consistency: ConsistencyReport
}

/**
 * A13'ün üç aşamasını sırayla koşar. Her bölüm kendi çağrısını alır;
 * tutarlılık geçişine yalnız özetler gider.
 */
export async function generateDraft(
  input: DraftInput,
  backend: DraftBackend,
  context: SectionContext = {},
): Promise<DraftResult> {
  const skeleton = await backend.planSkeleton(input)

  const sections: DraftSection[] = []
  for (const plan of skeleton.sections) {
    sections.push(await backend.writeSection(plan, context))
  }

  const summaries: SectionSummary[] = sections.map((section) => ({
    heading: section.heading,
    summary: section.summary,
  }))
  const totalTokens = summaries.reduce((sum, s) => sum + estimateTokens(s.summary), 0)
  if (totalTokens > CONSISTENCY_SUMMARY_BUDGET) throw new ConsistencySummaryTooLongError(totalTokens)

  const consistency = await backend.reviewConsistency(summaries)

  return { skeleton, sections, consistency }
}
