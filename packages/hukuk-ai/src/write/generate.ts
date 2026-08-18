/**
 * Aşamalı üretim — plan M8.7, `CAPABILITIES.md` A13 / A.0.
 *
 * Uzun bir dilekçe tek geçişte yazılmaz: **iskelet → bölüm bölüm → tutarlılık
 * geçişi**. Her aşama kendi bağlam bütçesiyle sınırlıdır ve modele değil,
 * dışarıdan verilen `WriteBackend`'e (cihaz içi model) çağrı yapar — bu
 * modül hiçbir zaman ağa çıkmaz (M8.1).
 */

import type { FewShotExample } from './fewshot'
import type { StyleProfile } from './style'
import { meanSentenceWords } from './style'

export interface WriteBackend {
  generate(prompt: string): Promise<string> | string
}

/** İskelet planı bağlam bütçesi (`CAPABILITIES.md` A13.1: ~500 token, ~30 sn). */
export const SKELETON_PLAN_CHAR_BUDGET = 500 * 4
/** Bölüm üretimi bağlam bütçesi (A9/A13.2: ≤ 2.000 token). */
export const SECTION_CONTEXT_CHAR_BUDGET = 2000 * 4
/** Tutarlılık geçişi bağlam bütçesi (A13.3: 12 özet ≈ 1.500 token). */
export const CONSISTENCY_CONTEXT_CHAR_BUDGET = 1500 * 4
/** Her bölüm özetinin tutarlılık geçişine giren azami uzunluğu. */
const SECTION_SUMMARY_CHAR_LIMIT = 240

class ContextBudgetError extends Error {
  override readonly name: string = 'ContextBudgetError'
  readonly charCount: number
  readonly budget: number

  constructor(stage: string, charCount: number, budget: number) {
    super(`${stage} bağlamı bütçeyi aşıyor (${charCount} > ${budget} karakter, CAPABILITIES.md A13).`)
    this.charCount = charCount
    this.budget = budget
  }
}

export class SkeletonPlanContextTooLargeError extends ContextBudgetError {
  override readonly name = 'SkeletonPlanContextTooLargeError'
  constructor(charCount: number, budget = SKELETON_PLAN_CHAR_BUDGET) {
    super('İskelet planı', charCount, budget)
  }
}

export class SectionContextTooLargeError extends ContextBudgetError {
  override readonly name = 'SectionContextTooLargeError'
  constructor(charCount: number, budget = SECTION_CONTEXT_CHAR_BUDGET) {
    super('Bölüm', charCount, budget)
  }
}

export class ConsistencyContextTooLargeError extends ContextBudgetError {
  override readonly name = 'ConsistencyContextTooLargeError'
  constructor(charCount: number, budget = CONSISTENCY_CONTEXT_CHAR_BUDGET) {
    super('Tutarlılık geçişi', charCount, budget)
  }
}

function summarizeStyleProfile(profile: StyleProfile): string {
  const parts: string[] = [`ortalama cümle uzunluğu ${meanSentenceWords(profile).toFixed(1)} kelime`]
  if (profile.closings[0]) parts.push(`kapanış: "${profile.closings[0].phrase}"`)
  if (profile.salutations[0]) parts.push(`hitap: "${profile.salutations[0].phrase}"`)
  if (profile.boilerplatePhrases[0]) parts.push(`kalıp ifade: "${profile.boilerplatePhrases[0].phrase}"`)
  return parts.join('; ')
}

/** §1 — İskelet: başlık planı üretilir. Girdi olgu kayıtları da bağlama girer. */
export function buildSkeletonPlanPrompt(instructions: string, facts: readonly string[]): string {
  const factLines = facts.length > 0 ? `\nOlgular:\n${facts.map((fact) => `- ${fact}`).join('\n')}` : ''
  return `Talimat: ${instructions}${factLines}\nBu dilekçe için başlık planı üret, her başlık ayrı satırda olsun.`
}

export async function generateSkeletonPlan(
  instructions: string,
  facts: readonly string[],
  backend: WriteBackend,
): Promise<readonly string[]> {
  const prompt = buildSkeletonPlanPrompt(instructions, facts)
  if (prompt.length > SKELETON_PLAN_CHAR_BUDGET) throw new SkeletonPlanContextTooLargeError(prompt.length)

  const response = await backend.generate(prompt)
  return response
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export interface SectionContext {
  readonly planHeadings: readonly string[]
  readonly heading: string
  /** Bu bölüme atanmış olgu kayıtları — tüm dosya değil, yalnız bu bölüm. */
  readonly facts: readonly string[]
  readonly styleProfile?: StyleProfile
  readonly fewShot?: readonly FewShotExample[]
}

export interface DraftSection {
  readonly heading: string
  readonly text: string
}

/** §2 — Bölüm bölüm üretim: iskelet + bölüme atanmış olgular + üslup + few-shot. */
export function buildSectionPrompt(context: SectionContext): string {
  const lines: string[] = [
    `Plan: ${context.planHeadings.join(' > ')}`,
    `Yazılacak bölüm: ${context.heading}`,
  ]
  if (context.facts.length > 0) {
    lines.push('Olgular:', ...context.facts.map((fact) => `- ${fact}`))
  }
  if (context.styleProfile) {
    lines.push(`Üslup: ${summarizeStyleProfile(context.styleProfile)}`)
  }
  if (context.fewShot && context.fewShot.length > 0) {
    lines.push('Örnek dilekçe parçaları:')
    for (const example of context.fewShot) lines.push(`--- ${example.id} ---`, example.text)
  }
  return lines.join('\n')
}

export async function generateSection(context: SectionContext, backend: WriteBackend): Promise<DraftSection> {
  const prompt = buildSectionPrompt(context)
  if (prompt.length > SECTION_CONTEXT_CHAR_BUDGET) throw new SectionContextTooLargeError(prompt.length)

  const text = await backend.generate(prompt)
  return { heading: context.heading, text }
}

function summarizeSection(section: DraftSection): string {
  const flat = section.text.replace(/\s+/gu, ' ').trim()
  const truncated = flat.length > SECTION_SUMMARY_CHAR_LIMIT ? `${flat.slice(0, SECTION_SUMMARY_CHAR_LIMIT)}…` : flat
  return `${section.heading}: ${truncated}`
}

export interface ConsistencyResult {
  readonly notes: readonly string[]
  readonly contextCharCount: number
}

/** §3 — Tutarlılık geçişi: bölümlerin ÖZETLERİ üzerinde, tek pencerede. */
export function buildConsistencyPrompt(sections: readonly DraftSection[]): string {
  const summaries = sections.map(summarizeSection)
  return `Aşağıdaki bölüm özetleri arasında çelişki, tekrar veya numaralandırma/atıf/terim tutarsızlığı var mı? Varsa listele.\n${summaries.join('\n')}`
}

export async function runConsistencyPass(
  sections: readonly DraftSection[],
  backend: WriteBackend,
): Promise<ConsistencyResult> {
  const prompt = buildConsistencyPrompt(sections)
  if (prompt.length > CONSISTENCY_CONTEXT_CHAR_BUDGET) {
    throw new ConsistencyContextTooLargeError(prompt.length)
  }

  const response = await backend.generate(prompt)
  const notes = response
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  return { notes, contextCharCount: prompt.length }
}

export interface GenerateStagedDraftOptions {
  readonly instructions: string
  /** Tüm olgu kayıtları — yalnız iskelet planına girer. */
  readonly facts?: readonly string[]
  /** Başlık → o bölüme atanmış olgu kayıtları. Verilmeyen başlık boş olgu alır. */
  readonly factsBySection?: Readonly<Record<string, readonly string[]>>
  readonly styleProfile?: StyleProfile
  readonly fewShot?: readonly FewShotExample[]
}

export interface StagedDraft {
  readonly headings: readonly string[]
  readonly sections: readonly DraftSection[]
  readonly consistencyNotes: readonly string[]
}

/**
 * Üç aşamayı sırayla çalıştırır. Bölümler birbirinden **bağımsız** üretilir
 * (`Promise.all`) — biri diğerinin taslağını görmez, yalnız ortak iskelet
 * planını ve kendi olgu altkümesini görür.
 */
export async function generateStagedDraft(
  options: GenerateStagedDraftOptions,
  backend: WriteBackend,
): Promise<StagedDraft> {
  const facts = options.facts ?? []
  const headings = await generateSkeletonPlan(options.instructions, facts, backend)

  const sections = await Promise.all(
    headings.map((heading) =>
      generateSection(
        {
          planHeadings: headings,
          heading,
          facts: options.factsBySection?.[heading] ?? [],
          styleProfile: options.styleProfile,
          fewShot: options.fewShot,
        },
        backend,
      ),
    ),
  )

  const consistency = await runConsistencyPass(sections, backend)

  return { headings, sections, consistencyNotes: consistency.notes }
}
