/**
 * Aşamalı üretim — plan M8.7, `docs/CAPABILITIES.md` A13.
 *
 * İskelet → bölüm bölüm üretim → tutarlılık geçişi:
 *   1. Her bölüm KENDİ bağımsız çağrısında yazılır (§2) — prompt yalnız o
 *      bölüme atanmış olgu/talep referanslarını taşır, önceki bölümlerin tam
 *      metnini değil. Bağlam bütçesi ≤ 2.000 token, aşılırsa hata (sessizce
 *      kırpma yok — kırpma olgu kaybı demektir).
 *   2. Tutarlılık geçişi ikiye ayrılır (§3):
 *      - Numaralandırma / atıf / terim: DETERMİNİSTİK, model yok.
 *      - Bölümler arası çelişki/tekrar: bölüm ÖZETLERİ TEK pencerede,
 *        ayrı bir `ConsistencyReviewBackend`e devredilir (≤ 1.500 token).
 */

import type { NumberingScheme } from './skeleton'
import type { FewShotExample } from './fewShot'
import type { StyleProfile } from './styleProfile'
import { estimateTokens, type WriteBackend } from './types'

export interface SectionSpec {
  readonly heading: string
  readonly numbering?: string
  /** Bu bölüme atanmış olgu/talep referansları (A10 olgu kaydı biçiminde). */
  readonly facts: readonly string[]
}

export interface WriteContext {
  readonly styleProfile?: StyleProfile
  readonly fewShot?: readonly FewShotExample[]
}

export interface SectionResult {
  readonly heading: string
  readonly numbering?: string
  readonly content: string
}

export class TokenBudgetExceededError extends Error {
  override readonly name = 'TokenBudgetExceededError'
  constructor(context: string, tokens: number, budget: number) {
    super(`${context}: ${tokens} token — bütçe ${budget} token aşıldı.`)
  }
}

const SECTION_TOKEN_BUDGET = 2000

function buildSectionPrompt(spec: SectionSpec, context: WriteContext): string {
  const lines = [`BÖLÜM: ${spec.heading}`]
  if (spec.facts.length > 0) lines.push('OLGULAR:', ...spec.facts.map((fact) => `- ${fact}`))
  if (context.styleProfile) {
    lines.push(
      `ÜSLUP: ortalama cümle ~${Math.round(context.styleProfile.sentenceLength.mean)} kelime, ` +
        `numaralandırma: ${context.styleProfile.numberingScheme}`,
    )
  }
  if (context.fewShot && context.fewShot.length > 0) {
    lines.push('ÖRNEKLER:', ...context.fewShot.map((example) => example.text))
  }
  return lines.join('\n')
}

/** Tek bölümü yazar — bağımsız çağrı, önceki bölümlerin metni bağlama girmez. */
export async function writeSection(
  spec: SectionSpec,
  context: WriteContext,
  backend: WriteBackend,
): Promise<SectionResult> {
  const prompt = buildSectionPrompt(spec, context)
  const tokens = estimateTokens(prompt)
  if (tokens > SECTION_TOKEN_BUDGET) {
    throw new TokenBudgetExceededError(`"${spec.heading}" bölümü`, tokens, SECTION_TOKEN_BUDGET)
  }

  const content = await backend.generate(prompt, { maxTokens: SECTION_TOKEN_BUDGET })
  return spec.numbering
    ? { heading: spec.heading, numbering: spec.numbering, content }
    : { heading: spec.heading, content }
}

/** Bölümler sırayla, her biri kendi bağımsız çağrısıyla yazılır. */
export async function writeStaged(
  sections: readonly SectionSpec[],
  context: WriteContext,
  backend: WriteBackend,
): Promise<readonly SectionResult[]> {
  const results: SectionResult[] = []
  for (const spec of sections) results.push(await writeSection(spec, context, backend))
  return results
}

export type ConsistencyIssueKind = 'numbering' | 'citation' | 'terim'

export interface ConsistencyIssue {
  readonly kind: ConsistencyIssueKind
  readonly heading: string
  readonly detail: string
}

const ROMAN_VALUES: Readonly<Record<string, number>> = {
  I: 1,
  V: 5,
  X: 10,
  L: 50,
  C: 100,
  D: 500,
  M: 1000,
}

function romanToInt(roman: string): number | undefined {
  let total = 0
  for (let i = 0; i < roman.length; i++) {
    const current = ROMAN_VALUES[roman[i] ?? '']
    const next = ROMAN_VALUES[roman[i + 1] ?? '']
    if (current === undefined) return undefined
    total += next !== undefined && current < next ? -current : current
  }
  return total
}

function topLevelNumber(numbering: string, scheme: NumberingScheme): number | undefined {
  const top = numbering.split('.')[0] ?? numbering
  if (scheme === 'roman') return romanToInt(top)
  if (scheme === 'arabic') {
    const value = Number(top)
    return Number.isNaN(value) ? undefined : value
  }
  if (scheme === 'lettered' && top.length === 1) {
    return top.toLocaleUpperCase('tr').codePointAt(0)
  }
  return undefined
}

/** Yalnız üst seviye başlıkların sırası denetlenir; alt maddeler (1.1, 1.2) atlanır. */
function checkNumbering(
  sections: readonly SectionResult[],
  scheme: NumberingScheme,
): readonly ConsistencyIssue[] {
  if (scheme === 'none' || scheme === 'mixed') return []

  const issues: ConsistencyIssue[] = []
  let previous: number | undefined

  for (const section of sections) {
    if (!section.numbering || section.numbering.includes('.')) continue
    const current = topLevelNumber(section.numbering, scheme)
    if (current === undefined) continue
    if (previous !== undefined && current !== previous + 1) {
      issues.push({
        kind: 'numbering',
        heading: section.heading,
        detail: `Beklenen sıradaki numara bu değil (önceki: ${previous}, bulunan: ${section.numbering}).`,
      })
    }
    previous = current
  }

  return issues
}

const CITATION_NUMBER_FIRST = /\d{4}\/\d+\s*(?:E\.|K\.)/g
const CITATION_MARKER_FIRST = /(?:E\.|K\.)\s*\d{4}\/\d+/g

/** Atıf biçimi tek belgede iki farklı sırada karışık kullanılmışsa yakalar. */
function checkCitations(sections: readonly SectionResult[]): readonly ConsistencyIssue[] {
  let numberFirst = 0
  let markerFirst = 0
  for (const section of sections) {
    numberFirst += section.content.match(CITATION_NUMBER_FIRST)?.length ?? 0
    markerFirst += section.content.match(CITATION_MARKER_FIRST)?.length ?? 0
  }
  if (numberFirst === 0 || markerFirst === 0) return []
  return [
    {
      kind: 'citation',
      heading: '(belge geneli)',
      detail: `Atıf biçimi tutarsız: ${numberFirst} "yıl/sıra E./K." ve ${markerFirst} "E./K. yıl/sıra" biçiminde karışık kullanılmış.`,
    },
  ]
}

/** Aynı terimin bilinen yazım varyantları — profildeki baskın biçimden sapma yakalanır. */
const TERM_VARIANT_GROUPS: readonly (readonly string[])[] = [['vekâlet ücreti', 'vekalet ücreti']]

function checkTerms(
  sections: readonly SectionResult[],
  profile: StyleProfile,
): readonly ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = []

  for (const group of TERM_VARIANT_GROUPS) {
    const ranked = [...group]
      .map((variant) => ({
        variant,
        count: profile.preferredTerms.find((entry) => entry.phrase === variant)?.count ?? 0,
      }))
      .sort((a, b) => b.count - a.count)
    const preferred = ranked[0]
    if (!preferred || preferred.count === 0) continue

    for (const section of sections) {
      const lower = section.content.toLocaleLowerCase('tr')
      for (const variant of group) {
        if (variant === preferred.variant) continue
        if (lower.includes(variant)) {
          issues.push({
            kind: 'terim',
            heading: section.heading,
            detail: `"${variant}" kullanılmış; üslup profili "${preferred.variant}" biçimini tercih ediyor.`,
          })
        }
      }
    }
  }

  return issues
}

export interface CheckConsistencyOptions {
  readonly numberingScheme?: NumberingScheme
  readonly styleProfile?: StyleProfile
}

/**
 * Numaralandırma, atıf ve terim tutarlılığını DETERMİNİSTİK denetler — model
 * çağırmaz. Bölümler arası anlamsal çelişki için `reviewSectionConsistency`
 * kullanılır (o, tek bir modele bölüm özetlerini gönderir).
 */
export function checkConsistency(
  sections: readonly SectionResult[],
  options: CheckConsistencyOptions = {},
): readonly ConsistencyIssue[] {
  const scheme = options.numberingScheme ?? options.styleProfile?.numberingScheme ?? 'none'
  return [
    ...checkNumbering(sections, scheme),
    ...checkCitations(sections),
    ...(options.styleProfile ? checkTerms(sections, options.styleProfile) : []),
  ]
}

export interface SectionSummary {
  readonly heading: string
  readonly summary: string
}

export interface ConsistencyReviewBackend {
  readonly id: string
  readonly runsLocally: true
  review(summaries: readonly SectionSummary[]): string | Promise<string>
}

export interface ConsistencyReview {
  readonly report: string
  readonly usedTokens: number
}

const REVIEW_TOKEN_BUDGET = 1500

function summarizeSection(section: SectionResult): string {
  const firstSentence = section.content.split(/(?<=[.!?])\s+/)[0] ?? section.content
  return firstSentence.slice(0, 200)
}

/**
 * Bölümler arası çelişki/tekrar denetimi — TÜM özetler TEK pencerede (A13 §3),
 * M7.6'daki "K bağımsız geçiş" kuralının aksine burada birleştirme kasıtlı:
 * çelişki tespiti bölümleri birbirine kıyaslamayı gerektirir.
 */
export async function reviewSectionConsistency(
  sections: readonly SectionResult[],
  backend: ConsistencyReviewBackend,
): Promise<ConsistencyReview> {
  const summaries = sections.map((section) => ({
    heading: section.heading,
    summary: summarizeSection(section),
  }))
  const usedTokens = estimateTokens(
    summaries.map((entry) => `${entry.heading}: ${entry.summary}`).join('\n'),
  )
  if (usedTokens > REVIEW_TOKEN_BUDGET) {
    throw new TokenBudgetExceededError('Tutarlılık geçişi', usedTokens, REVIEW_TOKEN_BUDGET)
  }

  return { report: await backend.review(summaries), usedTokens }
}
