/**
 * Aşamalı üretim orkestrasyonu — plan M8.7, `docs/CAPABILITIES.md` A13.
 *
 * "1. İskelet. 2. Bölüm bölüm üretim... ≤ 2.000 token penceresinde.
 * 3. Tutarlılık geçişi... bölümlerin ÖZETLERİ üzerinde."
 *
 * Model burada uygulanmaz — üç arka uç da (`OutlineBackend`, `SectionBackend`,
 * `ConsistencyBackend`) dışarıdan verilir; bu dosya yalnız SIRAYI ve BAĞLAM
 * SINIRINI zorlar:
 *   - Bölüm üretimi TEK bölüm alır; diğer bölümlerin tam metnini asla görmez
 *     (imza böyle kurulu — erişecek yol yok).
 *   - Tutarlılık geçişi bölümlerin TAM METNİNİ değil, ÖZETLERİNİ görür.
 *   - Bölümler SIRAYLA üretilir (paralel değil) — A13 "kesintili, her bölüm
 *     ayrı ayrı okunup onaylanabilir" gereği; kullanıcı arada durabilir.
 *
 * Yarıda kalan üretim `resume` ile kaldığı bölümden sürdürülür (A.0 §4) —
 * baştan başlamak yok. Hangi bölümün tamamlandığı çağıranın sorumluluğunda
 * diske yazılır (A.0 §3); bu paket yalnız yeniden başlatıldığında neyi
 * atlayacağını bilir.
 */

import type { RepresentativeExcerpt, StyleProfile } from './styleProfile'
import { splitSentences } from './textStats'
import { type FewShotOptions, selectFewShot } from './fewShot'

export interface OutlineSection {
  readonly heading: string
  /** Bu bölümde işlenecek olgu/talep notları — serbest metin, şema dayatılmaz. */
  readonly notes: readonly string[]
}

export interface DraftOutline {
  readonly sections: readonly OutlineSection[]
}

export interface OutlineRequest {
  readonly caseSummary: string
  readonly styleProfile: StyleProfile
}

export interface OutlineBackend {
  readonly id: string
  readonly runsLocally: true
  outline(request: OutlineRequest): DraftOutline | Promise<DraftOutline>
}

export interface DraftSection {
  readonly heading: string
  readonly text: string
}

export interface SectionRequest {
  readonly heading: string
  readonly notes: readonly string[]
  readonly styleProfile: StyleProfile
  /** M8.5 seçiminden — yalnız BU bölümün bağlamına göre seçilmiş alıntılar. */
  readonly fewShot: readonly RepresentativeExcerpt[]
}

export interface SectionBackend {
  readonly id: string
  readonly runsLocally: true
  writeSection(request: SectionRequest): string | Promise<string>
}

export interface SectionSummary {
  readonly heading: string
  readonly summary: string
}

export interface ConsistencyIssue {
  readonly headings: readonly string[]
  readonly description: string
}

export interface ConsistencyRequest {
  readonly sectionSummaries: readonly SectionSummary[]
}

export interface ConsistencyBackend {
  readonly id: string
  readonly runsLocally: true
  review(request: ConsistencyRequest): readonly ConsistencyIssue[] | Promise<readonly ConsistencyIssue[]>
}

export interface DraftResult {
  readonly outline: DraftOutline
  readonly sections: readonly DraftSection[]
  readonly consistencyIssues: readonly ConsistencyIssue[]
}

export interface GenerateDraftOptions {
  readonly outlineBackend: OutlineBackend
  readonly sectionBackend: SectionBackend
  readonly consistencyBackend: ConsistencyBackend
  /** Bölüm özetleyici — varsayılan: ilk iki cümle (deterministik, modelsiz). */
  readonly summarizeSection?: (section: DraftSection) => string
  readonly fewShotExcerpts?: readonly RepresentativeExcerpt[]
  readonly fewShotOptions?: FewShotOptions
  /** Yarıda kalan üretimi sürdürmek için — daha önce üretilmiş bölümler. */
  readonly resume?: { readonly outline: DraftOutline; readonly sections: readonly DraftSection[] }
}

function defaultSummarizeSection(section: DraftSection): string {
  return splitSentences(section.text).slice(0, 2).join(' ')
}

/**
 * Üç aşamayı sırayla koşar: iskelet → bölüm bölüm (sırayla, kesintili) →
 * tutarlılık (yalnız özetler üzerinde).
 */
export async function generateDraft(
  caseSummary: string,
  styleProfile: StyleProfile,
  options: GenerateDraftOptions,
): Promise<DraftResult> {
  const outline = options.resume?.outline ?? (await options.outlineBackend.outline({ caseSummary, styleProfile }))
  const completed = new Map((options.resume?.sections ?? []).map((section) => [section.heading, section]))
  const summarize = options.summarizeSection ?? defaultSummarizeSection

  const sections: DraftSection[] = []
  for (const outlineSection of outline.sections) {
    const existing = completed.get(outlineSection.heading)
    if (existing) {
      sections.push(existing)
      continue
    }

    const fewShot = options.fewShotExcerpts
      ? selectFewShot(
          [outlineSection.heading, ...outlineSection.notes].join(' '),
          options.fewShotExcerpts,
          options.fewShotOptions,
        ).excerpts
      : []

    const text = await options.sectionBackend.writeSection({
      heading: outlineSection.heading,
      notes: outlineSection.notes,
      styleProfile,
      fewShot,
    })
    sections.push({ heading: outlineSection.heading, text })
  }

  const sectionSummaries = sections.map((section) => ({
    heading: section.heading,
    summary: summarize(section),
  }))
  const consistencyIssues = await options.consistencyBackend.review({ sectionSummaries })

  return { outline, sections, consistencyIssues }
}
