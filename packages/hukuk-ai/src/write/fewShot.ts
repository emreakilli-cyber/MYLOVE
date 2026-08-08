/**
 * Few-shot seçimi — plan M8.5, `CAPABILITIES.md` A6/A9 bağlam bütçesi.
 *
 * En benzer 2–3 dilekçeyi bağlama koyar. Benzerlik ölçütü kelime kümesi
 * üzerinde Jaccard'dır — gömme modeli gerektirmez, tamamen cihaz içi ve
 * deterministiktir. Bağlam bütçesi (**≤ 2.000 token**) aşıldığında seçim
 * durur; büyük ama daha az benzer bir aday, sırası gelince bütçeye
 * sığmıyorsa atlanır, daha küçük bir sonraki aday denenir.
 */

export interface FewShotCandidate {
  readonly id: string
  readonly text: string
}

export interface FewShotExample extends FewShotCandidate {
  readonly similarity: number
}

export interface FewShotSelection {
  readonly examples: readonly FewShotExample[]
  readonly estimatedTokens: number
}

export interface FewShotOptions {
  readonly maxExamples?: number
  readonly maxTokens?: number
}

const DEFAULT_MAX_EXAMPLES = 3
const DEFAULT_MAX_TOKENS = 2000

/**
 * Kaba Türkçe token tahmini. Gerçek tokenizer cihazda yok; karakter/4
 * yaklaşımı `MODEL.md`'deki aday modellerin tipik oranıyla uyumludur ve
 * bütçe denetimi için yeterli hassasiyettedir.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function tokenize(text: string): ReadonlySet<string> {
  const words = text.toLocaleLowerCase('tr').match(/\p{L}+/gu) ?? []
  return new Set(words)
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const word of a) if (b.has(word)) intersection += 1
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

export function selectFewShot(
  query: string,
  candidates: readonly FewShotCandidate[],
  options: FewShotOptions = {},
): FewShotSelection {
  const maxExamples = options.maxExamples ?? DEFAULT_MAX_EXAMPLES
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS
  const queryTokens = tokenize(query)

  const ranked = candidates
    .map((candidate) => ({ ...candidate, similarity: jaccard(queryTokens, tokenize(candidate.text)) }))
    .filter((candidate) => candidate.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)

  const examples: FewShotExample[] = []
  let estimatedTokens = 0

  for (const candidate of ranked) {
    if (examples.length >= maxExamples) break
    const tokens = estimateTokens(candidate.text)
    if (estimatedTokens + tokens > maxTokens) continue
    examples.push(candidate)
    estimatedTokens += tokens
  }

  return { examples, estimatedTokens }
}
