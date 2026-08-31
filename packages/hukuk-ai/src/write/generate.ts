/**
 * Aşamalı layiha üretimi — plan M8.7, `CAPABILITIES.md` A13.
 *
 * A13'ün üç aşaması burada üç AYRI, bağımsız çağrılabilir fonksiyona
 * karşılık gelir — tek bir "belgeyi üret" fonksiyonu bilerek yazılmadı,
 * çünkü A13'ün iddiası tam olarak şu: her bölüm "ayrı ayrı okunup
 * onaylanabilir" (kesintili üretim). Üç aşamayı tek fonksiyonda gizlemek bu
 * onay noktalarını koddan siler.
 *
 *   1. `planSkeleton`   — iskelet: başlık planı (~500 token).
 *   2. `writeSections`  — bölüm bölüm üretim; her bölüm KENDİ penceresinde
 *                         (≤ 2.000 token), diğer bölümlerin tam metnini
 *                         GÖRMEDEN yazılır (M7.6'daki "K bağımsız geçiş"
 *                         desenle aynı mimari garanti).
 *   3. `checkNumberingConsistency` + `reviewNarrativeConsistency` —
 *      tutarlılık geçişi; numaralandırma DETERMİNİSTİK denetlenir (model
 *      gerekmez, `skeleton.ts` yeniden kullanılır), anlatı tutarlılığı
 *      bölüm ÖZETLERİ üzerinde tek pencerede değerlendirilir (~1.500 token).
 *
 * Üç arayüz de (`SkeletonPlanner`, `SectionWriter`, `ConsistencyReviewer`)
 * `runsLocally: true` taşır — cihaz içi model, ağ yok (M8.1).
 */

import { extractSkeleton, type NumberingStyle } from './skeleton'
import { estimateTokens } from '../shared/tokenEstimate'
import type { FewShotExample } from './fewshot'
import type { StyleProfile } from './style'

/** A13: "İskelet. ... ~500 token, 30 sn." */
export const SKELETON_MAX_CONTEXT_TOKENS = 500
/** A13: "Her bölüm ... ≤ 2.000 token penceresinde yazılır." */
export const SECTION_MAX_CONTEXT_TOKENS = 2000
/** A13: "12 özet ≈ 1.500 token, tek pencere." */
export const CONSISTENCY_PASS_MAX_TOKENS = 1500

export interface SectionPlan {
  readonly title: string
  /** Bu bölüme atanan olgu/talep kaydı referansları (A10 ile bağlantılı; bu paket için opak string). */
  readonly factRefs: readonly string[]
}

export interface DocumentPlan {
  readonly sections: readonly SectionPlan[]
}

export interface SkeletonPlanningContext {
  readonly caseSummary: string
  readonly styleProfile: StyleProfile
}

export class SkeletonPlanningInputTooLongError extends Error {
  override readonly name = 'SkeletonPlanningInputTooLongError'
  readonly estimatedTokens: number
  readonly limit: number

  constructor(estimatedTokens: number, limit: number) {
    super(
      `İskelet planlama girdisi çok uzun (~${estimatedTokens} token, sınır ~${limit}). ` +
        'A13: olay özeti kısa tutulmalı, iskelet aşaması tek pencereye sığmalı.',
    )
    this.estimatedTokens = estimatedTokens
    this.limit = limit
  }
}

export interface SkeletonPlanner {
  readonly id: string
  readonly runsLocally: true
  plan(context: SkeletonPlanningContext): Promise<DocumentPlan> | DocumentPlan
}

/** A13 aşama 1 — iskelet. Girdi bütçeyi aşıyorsa modele hiç gitmeden reddedilir. */
export async function planSkeleton(
  context: SkeletonPlanningContext,
  planner: SkeletonPlanner,
): Promise<DocumentPlan> {
  const estimated = estimateTokens(context.caseSummary)
  if (estimated > SKELETON_MAX_CONTEXT_TOKENS) {
    throw new SkeletonPlanningInputTooLongError(estimated, SKELETON_MAX_CONTEXT_TOKENS)
  }
  return planner.plan(context)
}

export interface SectionWritingContext {
  readonly section: SectionPlan
  readonly styleProfile: StyleProfile
  /** `selectFewShot` çıktısı — bütçe orada zaten uygulanmıştır (M8.5). */
  readonly fewShot: readonly FewShotExample[]
}

export interface SectionWriter {
  readonly id: string
  readonly runsLocally: true
  /** TEK bölüm alır. Diğer bölümlerin tam metni asla parametre olarak verilmez. */
  writeSection(context: SectionWritingContext): Promise<string> | string
}

export interface GeneratedSection {
  readonly title: string
  readonly text: string
}

/**
 * A13 aşama 2 — bölüm bölüm üretim. Her bölüm bağımsız bir çağrıda yazılır;
 * çağrılar eşzamanlı yürütülür çünkü aralarında veri bağımlılığı yoktur
 * (sıra sonucu etkilemez, tıpkı `research/correlate.ts`daki gibi).
 */
export async function writeSections(
  plan: DocumentPlan,
  styleProfile: StyleProfile,
  fewShotBySection: ReadonlyMap<string, readonly FewShotExample[]>,
  writer: SectionWriter,
): Promise<readonly GeneratedSection[]> {
  return Promise.all(
    plan.sections.map(async (section) => {
      const fewShot = fewShotBySection.get(section.title) ?? []
      const text = await writer.writeSection({ section, styleProfile, fewShot })
      return { title: section.title, text }
    }),
  )
}

export interface ConsistencyIssue {
  readonly kind: 'numbering' | 'narrative'
  readonly detail: string
  readonly sectionTitles: readonly string[]
}

/**
 * A13 aşama 3a — numaralandırma tutarlılığı. TAMAMEN DETERMİNİSTİK: model
 * gerekmez, her bölümün baskın numaralandırma biçimi `skeleton.ts` ile
 * yeniden çıkarılır ve karşılaştırılır.
 */
export function checkNumberingConsistency(
  sections: readonly GeneratedSection[],
): readonly ConsistencyIssue[] {
  const stylesUsed = new Set<NumberingStyle>()
  const affected: string[] = []

  for (const section of sections) {
    const dominant = extractSkeleton(section.text).dominantNumberingStyle
    if (dominant === 'none') continue
    stylesUsed.add(dominant)
    affected.push(section.title)
  }

  if (stylesUsed.size <= 1) return []

  return [
    {
      kind: 'numbering',
      detail: `Bölümler farklı numaralandırma biçimi kullanıyor: ${[...stylesUsed].sort().join(', ')}.`,
      sectionTitles: affected,
    },
  ]
}

export interface SectionSummary {
  readonly title: string
  readonly summary: string
}

export class ConsistencyReviewInputTooLongError extends Error {
  override readonly name = 'ConsistencyReviewInputTooLongError'
  readonly estimatedTokens: number
  readonly limit: number

  constructor(estimatedTokens: number, limit: number) {
    super(
      `Tutarlılık geçişi girdisi çok uzun (~${estimatedTokens} token, sınır ~${limit}). ` +
        'A13: bölüm özetleri kısa tutulmalı, tutarlılık geçişi tek pencereye sığmalı.',
    )
    this.estimatedTokens = estimatedTokens
    this.limit = limit
  }
}

export interface ConsistencyReviewer {
  readonly id: string
  readonly runsLocally: true
  /** Bölümlerin TAM METNİ değil, ÖZETLERİ verilir — A13 bütçesi bunu gerektirir. */
  review(summaries: readonly SectionSummary[]): Promise<readonly ConsistencyIssue[]> | readonly ConsistencyIssue[]
}

/**
 * A13 aşama 3b — anlatı tutarlılığı. Girdi bölüm ÖZETLERİDİR, tam metin
 * değil; bu yüzden 12 bölümlük bir layiha bile tek pencereye sığar.
 */
export async function reviewNarrativeConsistency(
  summaries: readonly SectionSummary[],
  reviewer: ConsistencyReviewer,
): Promise<readonly ConsistencyIssue[]> {
  const combined = summaries.map((s) => s.summary).join(' ')
  const estimated = estimateTokens(combined)
  if (estimated > CONSISTENCY_PASS_MAX_TOKENS) {
    throw new ConsistencyReviewInputTooLongError(estimated, CONSISTENCY_PASS_MAX_TOKENS)
  }
  return reviewer.review(summaries)
}
