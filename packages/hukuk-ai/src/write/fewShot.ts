/**
 * Few-shot seçimi — plan M8.5, `CAPABILITIES.md` A9/A13.
 *
 * Benzerlik ölçütü: normalize edilmiş kelime kümeleri arasında Jaccard
 * benzerliği (`|A ∩ B| / |A ∪ B|`). Seçildi çünkü deterministiktir, model
 * gerektirmez (bu paket sıfır bağımlıdır) ve iki dilekçenin ortak kelime
 * dağarcığını — konu, taraf sıfatları, hukuki terimler — doğrudan ölçer.
 * Bilinen sınır: kelime SIRASINI görmez, yalnız kümeyi görür; iki dilekçe
 * aynı kelimeleri farklı sırada kullanıyorsa yine de benzer sayılır. Bu,
 * üslup değil KONU benzerliği için yeterlidir — üslup zaten `styleProfile`'da.
 *
 * Bağlam bütçesi (A9/A13): seçilen örnekler toplamda `FEW_SHOT_TOKEN_BUDGET`
 * (≤ 2.000 token) sınırını aşamaz — bölüm üretimi tek pencerede kalmak
 * zorunda. Sığmayan bir aday atlanır, ondan sonraki (daha düşük benzerlikte
 * ama daha kısa) aday denenir; bütçe elden geldiğince doldurulur.
 */

export interface FewShotCandidate {
  readonly id: string
  readonly text: string
}

export interface FewShotSelection extends FewShotCandidate {
  readonly similarity: number
}

export interface FewShotOptions {
  readonly maxExamples?: number
  readonly tokenBudget?: number
}

export const FEW_SHOT_TOKEN_BUDGET = 2000
export const FEW_SHOT_MAX_EXAMPLES = 3

/** Kaba token tahmini (~4 karakter/token) — kesin ölçüm değil, bütçe kontrolü içindir. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function normalizedWordSet(text: string): ReadonlySet<string> {
  return new Set(
    text
      .toLocaleLowerCase('tr-TR')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean),
  )
}

function jaccardSimilarity(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let intersection = 0
  for (const word of a) if (b.has(word)) intersection++
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

/**
 * En benzer 2–3 dilekçeyi seçer. Benzerliğe göre azalan sırada dener,
 * bütçeye sığanları alır; `maxExamples`'a ulaşınca durur.
 */
export function selectFewShotExamples(
  query: string,
  candidates: readonly FewShotCandidate[],
  options: FewShotOptions = {},
): readonly FewShotSelection[] {
  const maxExamples = options.maxExamples ?? FEW_SHOT_MAX_EXAMPLES
  const tokenBudget = options.tokenBudget ?? FEW_SHOT_TOKEN_BUDGET
  const queryWords = normalizedWordSet(query)

  const ranked = candidates
    .map((candidate) => ({
      ...candidate,
      similarity: jaccardSimilarity(queryWords, normalizedWordSet(candidate.text)),
    }))
    .sort((a, b) => b.similarity - a.similarity)

  const selected: FewShotSelection[] = []
  let usedTokens = 0
  for (const candidate of ranked) {
    if (selected.length >= maxExamples) break
    const tokens = estimateTokens(candidate.text)
    if (usedTokens + tokens > tokenBudget) continue
    selected.push(candidate)
    usedTokens += tokens
  }
  return selected
}
