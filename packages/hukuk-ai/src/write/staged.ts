/**
 * Aşamalı üretim — plan M8.7, `CAPABILITIES.md` A13.
 *
 * Üç aşama: **iskelet → bölüm bölüm üretim → tutarlılık geçişi.** Hiçbir
 * aşama tüm belgeyi birden görmez; bu, yorumla değil `WriteBackend`
 * imzasıyla zorlanır:
 *   - `generateSection` her çağrıda TEK bölüm görür (A13 §2).
 *   - `reviewConsistency` bölümlerin TAM METNİNİ değil, ÖZETLERİNİ görür
 *     (A13 §3) — imzada `text` alanı yoktur, yalnız `summary`.
 *
 * Üretimin kendisi (gerçek dil modeli) bu pakete ait değildir; `WriteBackend`
 * dışarıdan verilir (NER katmanındaki `NerBackend` deseniyle aynı, M3.2).
 * Bu modül ağa hiç çıkmaz (M8.1) — model cihaz içi çalışır.
 */

import type { FewShotSelection } from './fewShot'
import type { StyleProfile } from './styleProfile'

export interface OutlineSection {
  readonly heading: string
  /** Bu bölümde işlenecek olgu/talep referansları (bkz. A10 olgu kayıtları). */
  readonly factRefs: readonly string[]
}

export interface DocumentOutline {
  readonly sections: readonly OutlineSection[]
}

export interface OutlineRequest {
  readonly caseSummary: string
  readonly styleProfile?: StyleProfile
  readonly fewShot?: FewShotSelection
}

export interface SectionRequest {
  readonly outline: DocumentOutline
  /** Üretilecek TEK bölüm — diğer bölümler bu isteğe hiç girmez. */
  readonly section: OutlineSection
  readonly styleProfile?: StyleProfile
  readonly fewShot?: FewShotSelection
}

export interface GeneratedSection {
  readonly heading: string
  readonly text: string
}

/** Tutarlılık geçişinin gördüğü tek şey — tam metin YOK, yalnız özet. */
export interface SectionSummary {
  readonly heading: string
  readonly summary: string
}

export interface ConsistencyIssue {
  readonly headings: readonly string[]
  readonly description: string
}

export interface ConsistencyReport {
  readonly issues: readonly ConsistencyIssue[]
}

export interface WriteBackend {
  readonly id: string
  readonly runsLocally: true
  generateOutline(request: OutlineRequest): DocumentOutline | Promise<DocumentOutline>
  generateSection(request: SectionRequest): string | Promise<string>
  summarizeSection(section: GeneratedSection): string | Promise<string>
  reviewConsistency(
    summaries: readonly SectionSummary[],
  ): ConsistencyReport | Promise<ConsistencyReport>
}

export interface StagedDocument {
  readonly outline: DocumentOutline
  readonly sections: readonly GeneratedSection[]
  readonly consistency: ConsistencyReport
}

export interface GenerateStagedOptions {
  readonly styleProfile?: StyleProfile
  readonly fewShot?: FewShotSelection
}

export async function generateStaged(
  caseSummary: string,
  backend: WriteBackend,
  options: GenerateStagedOptions = {},
): Promise<StagedDocument> {
  const outline = await backend.generateOutline({
    caseSummary,
    styleProfile: options.styleProfile,
    fewShot: options.fewShot,
  })

  const sections: GeneratedSection[] = []
  for (const section of outline.sections) {
    const text = await backend.generateSection({
      outline,
      section,
      styleProfile: options.styleProfile,
      fewShot: options.fewShot,
    })
    sections.push({ heading: section.heading, text })
  }

  const summaries: SectionSummary[] = []
  for (const section of sections) {
    summaries.push({ heading: section.heading, summary: await backend.summarizeSection(section) })
  }

  const consistency = await backend.reviewConsistency(summaries)

  return { outline, sections, consistency }
}
