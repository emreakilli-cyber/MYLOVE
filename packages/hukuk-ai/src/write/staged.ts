/**
 * Aşamalı üretim — plan M8.7, `CAPABILITIES.md` A13.
 *
 * Sıra: **iskelet → bölüm bölüm üretim → tutarlılık geçişi**. Uzun bağlam
 * hiçbir aşamada gerekmez — bu, arayüzle zorlanır:
 *   - `writeSection` TEK bölümün bağlamını alır, tüm dosyayı değil.
 *   - `reviewConsistency` bölüm ÖZETLERİNİ alır, tam metinleri değil
 *     (A13 adım 3: "12 özet ≈ 1.500 token, tek pencere").
 *
 * Modelin kendisi bu dosyada yoktur — `StagedWriteBackend` dışarıdan verilir
 * (NER katmanındaki `NerBackend` deseninin aynısı, M8.1: ağ erişimi yasağı
 * `runsLocally: true` ile tip düzeyinde de işaretlenir).
 */

import { type FewShotCandidate, type FewShotExample, type FewShotOptions, selectFewShot } from './fewshot'
import type { StyleProfile } from './style'

export interface OutlineSection {
  readonly heading: string
  /** Bu bölüme atanan olgu/talep referansları (`CAPABILITIES.md` A10 olgu kayıtları). */
  readonly factRefs: readonly string[]
}

export interface SectionContext {
  readonly heading: string
  readonly factRefs: readonly string[]
  readonly style: StyleProfile
  readonly fewShotExamples: readonly FewShotExample[]
}

export interface ConsistencyIssue {
  readonly sectionHeading: string
  readonly note: string
}

export interface ConsistencyReport {
  readonly issues: readonly ConsistencyIssue[]
}

/** Model bağımsız arka uç. Ağ erişimi yasağı `runsLocally: true` ile zorlanır (M8.1). */
export interface StagedWriteBackend {
  readonly id: string
  readonly runsLocally: true
  planOutline(caseSummary: string, style: StyleProfile): Promise<readonly OutlineSection[]>
  writeSection(context: SectionContext): Promise<string>
  /** Girdi TAM bölüm metinleri değil, kısa özetlerdir — bkz. dosya başı not. */
  reviewConsistency(sectionSummaries: readonly string[]): Promise<ConsistencyReport>
}

export interface StagedSection {
  readonly heading: string
  readonly text: string
}

export interface StagedDocument {
  readonly outline: readonly OutlineSection[]
  readonly sections: readonly StagedSection[]
  readonly consistency: ConsistencyReport
}

export interface ProduceStagedOptions {
  readonly fewShotCorpus?: readonly FewShotCandidate[]
  readonly fewShotOptions?: FewShotOptions
  /** Bölüm bitince çağrılır — kullanıcı bölüm bölüm onaylayabilsin (A13 adım 2). */
  readonly onSectionComplete?: (section: StagedSection, index: number, total: number) => void
}

function firstSentence(text: string): string {
  return text.split(/(?<=[.!?])\s+/)[0] ?? text
}

/** Tutarlılık geçişine giden özet: başlık + bölümün ilk cümlesi. Kısa, ucuz. */
function summarizeForConsistency(section: StagedSection): string {
  return `${section.heading}: ${firstSentence(section.text)}`.trim()
}

/**
 * Aşamalı üretimi baştan sona çalıştırır. Her bölüm, önceki bölümlerin tam
 * metnini DEĞİL, yalnız kendi iskelet girdisini ve üslup profilini görür —
 * bu, ≤ 2.000 token bölüm penceresini yapısal olarak korur (A13 adım 2).
 */
export async function produceStaged(
  caseSummary: string,
  style: StyleProfile,
  backend: StagedWriteBackend,
  options: ProduceStagedOptions = {},
): Promise<StagedDocument> {
  const outline = await backend.planOutline(caseSummary, style)

  const sections: StagedSection[] = []
  for (let index = 0; index < outline.length; index += 1) {
    const planned = outline[index] as OutlineSection

    const fewShotExamples = options.fewShotCorpus
      ? selectFewShot(
          planned.factRefs.join(' ') || planned.heading,
          options.fewShotCorpus,
          options.fewShotOptions,
        )
      : []

    const text = await backend.writeSection({
      heading: planned.heading,
      factRefs: planned.factRefs,
      style,
      fewShotExamples,
    })

    const section: StagedSection = { heading: planned.heading, text }
    sections.push(section)
    options.onSectionComplete?.(section, index, outline.length)
  }

  const summaries = sections.map(summarizeForConsistency)
  const consistency = await backend.reviewConsistency(summaries)

  return { outline, sections, consistency }
}
