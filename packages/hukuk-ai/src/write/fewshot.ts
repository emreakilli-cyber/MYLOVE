/**
 * Few-shot seçimi — plan M8.5, `CAPABILITIES.md` A8/A9.
 *
 * En benzer 2–3 dilekçeyi bağlama koyar. Benzerlik ölçütü: normalleştirilmiş
 * kelime kümeleri üzerinde Jaccard benzerliği (kesişim / birleşim) — sözlük
 * gerektirmeyen, sıfır bağımlı bir ölçüt. Bağlam bütçesi ≤ 2.000 token
 * (`FEW_SHOT_CHAR_BUDGET`, ~4 karakter/token yaklaşıklığıyla).
 */

export interface FewShotExample {
  readonly id: string
  readonly text: string
}

export interface ScoredExample extends FewShotExample {
  readonly similarity: number
}

export interface FewShotSelection {
  readonly examples: readonly ScoredExample[]
  readonly usedChars: number
  /** Bütçe yüzünden dışarıda kalan, benzerliği daha düşük adaylar. */
  readonly skipped: readonly ScoredExample[]
}

/** ~2.000 token bağlam bütçesi, ~4 karakter/token yaklaşıklığı. */
export const FEW_SHOT_TOKEN_BUDGET = 2000
export const FEW_SHOT_CHAR_BUDGET = FEW_SHOT_TOKEN_BUDGET * 4

/** Varsayılan aday sayısı — SPEC/CAPABILITIES "en benzer 2–3 dilekçe" der. */
export const DEFAULT_FEW_SHOT_COUNT = 3

function normalize(text: string): Set<string> {
  return new Set(
    text
      .toLocaleLowerCase('tr')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/u)
      .filter((word) => word.length >= 3),
  )
}

/** Jaccard benzerliği: |A ∩ B| / |A ∪ B|. İki metin de boşsa 0 döner. */
export function jaccardSimilarity(a: string, b: string): number {
  const setA = normalize(a)
  const setB = normalize(b)
  if (setA.size === 0 || setB.size === 0) return 0

  let intersection = 0
  for (const word of setA) if (setB.has(word)) intersection += 1

  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

/**
 * Hedef metne en benzer `count` dilekçeyi bağlam bütçesi içinde seçer.
 *
 * Sıralama benzerliğe göredir; bütçeye greedy sığdırma yapılır — bir aday
 * kalan bütçeye sığmıyorsa atlanır, sıradaki (daha az benzer ama daha kısa)
 * adayla denenmeye devam edilir. Böylece dönen örnek sayısı `count`'tan az
 * olabilir; bu, bütçenin ihlal edilmemesi için kasıtlıdır.
 */
export function selectFewShot(
  target: string,
  corpus: readonly FewShotExample[],
  options: { count?: number; charBudget?: number } = {},
): FewShotSelection {
  const count = options.count ?? DEFAULT_FEW_SHOT_COUNT
  const charBudget = options.charBudget ?? FEW_SHOT_CHAR_BUDGET

  const ranked: ScoredExample[] = corpus
    .map((example) => ({ ...example, similarity: jaccardSimilarity(target, example.text) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, count)

  const examples: ScoredExample[] = []
  const skipped: ScoredExample[] = []
  let usedChars = 0

  for (const candidate of ranked) {
    if (usedChars + candidate.text.length <= charBudget) {
      examples.push(candidate)
      usedChars += candidate.text.length
    } else {
      skipped.push(candidate)
    }
  }

  return { examples, usedChars, skipped }
}
