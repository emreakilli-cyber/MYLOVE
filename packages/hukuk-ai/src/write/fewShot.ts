/**
 * Few-shot seçimi — plan M8.5, `docs/CAPABILITIES.md` A8/A9.
 *
 * Benzerlik ölçütü: normalize edilmiş kelime kümeleri üzerinde Jaccard
 * benzerliği (|A∩B| / |A∪B|). Model gerektirmez — gömme (embedding) modeli
 * telefon bütçesine (M3.4/MODEL.md) ek yük bindirir; kelime kümesi benzerliği
 * "en benzer 2–3 dilekçe" seçimi için yeterli ayrımı sağlar ve sıfır bağımlılık
 * kısıtına (M0.3) uyar.
 *
 * Bağlam bütçesi ≤ 2.000 token (A8/A9): adaylar benzerliğe göre sıralanır,
 * bütçeye sığanlar açgözlü (greedy) seçilir — bütçeyi aşan bir aday atlanır,
 * ama sıradaki daha küçük adaya bakmaya devam edilir.
 */

import { estimateTokens } from './types'

export interface PetitionExample {
  readonly id: string
  /** MASKELENMİŞ metin bekler — çağıran taraf maskelemeden geçirir. */
  readonly text: string
}

export interface FewShotExample extends PetitionExample {
  /** 0..1 — hedef metne kelime kümesi benzerliği. */
  readonly similarity: number
}

export interface FewShotOptions {
  readonly limit?: number
  readonly tokenBudget?: number
}

export interface FewShotSelection {
  readonly examples: readonly FewShotExample[]
  readonly usedTokens: number
  /** Bütçe yüzünden elenen aday olduysa bilgi notu. */
  readonly note?: string
}

const DEFAULT_LIMIT = 3
const DEFAULT_TOKEN_BUDGET = 2000

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLocaleLowerCase('tr')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean),
  )
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let intersection = 0
  for (const token of a) if (b.has(token)) intersection += 1
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

export function selectFewShot(
  target: string,
  candidates: readonly PetitionExample[],
  options: FewShotOptions = {},
): FewShotSelection {
  const limit = options.limit ?? DEFAULT_LIMIT
  const tokenBudget = options.tokenBudget ?? DEFAULT_TOKEN_BUDGET
  const targetTokens = tokenize(target)

  const ranked = candidates
    .map((candidate) => ({
      ...candidate,
      similarity: jaccardSimilarity(targetTokens, tokenize(candidate.text)),
    }))
    .sort((a, b) => b.similarity - a.similarity)

  const examples: FewShotExample[] = []
  let usedTokens = 0
  let skipped = 0

  for (const candidate of ranked) {
    if (examples.length >= limit) break
    const tokens = estimateTokens(candidate.text)
    if (usedTokens + tokens > tokenBudget) {
      skipped += 1
      continue
    }
    examples.push(candidate)
    usedTokens += tokens
  }

  return skipped > 0
    ? {
        examples,
        usedTokens,
        note: `${skipped} aday bağlam bütçesini (${tokenBudget} token) aşıp elendi.`,
      }
    : { examples, usedTokens }
}
