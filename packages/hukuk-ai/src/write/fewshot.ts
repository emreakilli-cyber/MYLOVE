/**
 * Few-shot seçimi — plan M8.5.
 *
 * `CAPABILITIES.md` A8.5: en benzer 2–3 dilekçeyi bağlama koy; bağlam bütçesi
 * **≤ 2.000 token**. Benzerlik ölçütü: sözcük çantası (bag-of-words) üzerinde
 * kosinüs benzerliği — model çağrısı gerektirmez, deterministiktir.
 *
 * Token bütçesi **tahminidir**, kesin değildir: gerçek tokenizasyon seçilen
 * modele bağlıdır ve bu paket hiçbir model çalıştırmaz. `estimateTokens`
 * sözcük sayısını 1,4 ile çarpar — Türkçenin sondan eklemeli yapısı alt
 * birimlere (subword) daha sık bölünür. Bu bir yaklaşıklıktır, kesinlik iddiası
 * taşımaz; bütçe aşımını önlemek için **kasıtlı olarak cömert** tahmin eder
 * (olduğundan fazla tahmin, az tahminden daha güvenlidir).
 */

const TOKENS_PER_WORD_ESTIMATE = 1.4

/** Kaba ama cömert token tahmini — bkz. dosya başı not. */
export function estimateTokens(text: string): number {
  const words = text.split(/\s+/).filter((word) => word.length > 0)
  return Math.ceil(words.length * TOKENS_PER_WORD_ESTIMATE)
}

function tokenize(text: string): readonly string[] {
  return text
    .toLocaleLowerCase('tr')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 1)
}

function termFrequency(text: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const token of tokenize(text)) counts.set(token, (counts.get(token) ?? 0) + 1)
  return counts
}

/** İki sözcük-frekans vektörü arasında kosinüs benzerliği. Ortak sözcük yoksa 0. */
function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0
  for (const [term, countA] of a) {
    const countB = b.get(term)
    if (countB !== undefined) dot += countA * countB
  }
  const normA = Math.sqrt([...a.values()].reduce((sum, count) => sum + count * count, 0))
  const normB = Math.sqrt([...b.values()].reduce((sum, count) => sum + count * count, 0))
  if (normA === 0 || normB === 0) return 0
  return dot / (normA * normB)
}

export interface FewShotCandidate {
  readonly id: string
  readonly text: string
}

export interface FewShotExample {
  readonly id: string
  readonly text: string
  readonly similarity: number
  readonly estimatedTokens: number
}

export interface FewShotSelection {
  readonly examples: readonly FewShotExample[]
  readonly totalEstimatedTokens: number
  /** Sıra/bütçe nedeniyle elenen aday sayısı — dürüstlük notu (A.0/7). */
  readonly excludedCount: number
}

export interface FewShotOptions {
  /** En benzer kaç örnek seçilsin. `CAPABILITIES.md` A8.5: 2–3. Varsayılan 3. */
  readonly maxExamples?: number
  /** Toplam bağlam bütçesi (token, tahmini). Varsayılan 2000. */
  readonly maxTokens?: number
}

/**
 * Hedef metne en benzer örnekleri, bütçe içinde kalarak seçer.
 *
 * Adaylar önce benzerliğe göre azalan sırada dizilir (eşitlikte giriş sırası
 * korunur — determinizm). Sıradaki aday bütçeyi aşıyorsa **atlanır, döngü
 * durmaz**: bütçeye sığan daha küçük ama daha az benzer bir sonraki aday
 * denenmeye devam eder. Böylece bütçe boşa harcanmaz.
 */
export function selectFewShotExamples(
  targetText: string,
  candidates: readonly FewShotCandidate[],
  options: FewShotOptions = {},
): FewShotSelection {
  const maxExamples = options.maxExamples ?? 3
  const maxTokens = options.maxTokens ?? 2000

  const targetVector = termFrequency(targetText)
  const ranked = candidates
    .map((candidate, index) => ({
      candidate,
      index,
      similarity: cosineSimilarity(targetVector, termFrequency(candidate.text)),
    }))
    .sort((a, b) => b.similarity - a.similarity || a.index - b.index)

  const examples: FewShotExample[] = []
  let totalTokens = 0

  for (const { candidate, similarity } of ranked) {
    if (examples.length >= maxExamples) break
    const estimatedTokens = estimateTokens(candidate.text)
    if (totalTokens + estimatedTokens > maxTokens) continue

    examples.push({ id: candidate.id, text: candidate.text, similarity, estimatedTokens })
    totalTokens += estimatedTokens
  }

  return {
    examples,
    totalEstimatedTokens: totalTokens,
    excludedCount: candidates.length - examples.length,
  }
}
