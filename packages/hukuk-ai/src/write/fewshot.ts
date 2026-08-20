/**
 * Few-shot seçimi — plan M8.5, `CAPABILITIES.md` A8 adım (c).
 *
 * **Benzerlik ölçütü:** sözcük kümesi üzerinde Jaccard benzerliği
 * (kesişim / birleşim). Gömme (embedding) modeli gerektirmez — sıfır
 * bağımlılık kuralına (M0.3) uyar ve deterministiktir: aynı korpus + aynı
 * hedef metin her zaman aynı sırayı üretir. Bedeli, eş anlamlı ama farklı
 * sözcüklerle yazılmış benzer belgeleri kaçırabilmesidir; bu, gömme
 * modeli eklenene kadar kabul edilen bir sınırdır.
 *
 * **Bağlam bütçesi:** varsayılan **2.000 token** (`CAPABILITIES.md` §0 —
 * cihaz içi model penceresi 4.000-8.000 token; 2.000 token few-shot için
 * ayrılan pay, kalanı sistem talimatı + hedef belgeye bırakır). Token sayısı
 * ölçülmez, **4 karakter ≈ 1 token** kaba tahminiyle üst sınırdan hesaplanır
 * — gerçek tokenizer'a bağımlı olmadan çalışması için bilerek muhafazakârdır.
 */

export interface FewShotCandidate {
  readonly id: string
  readonly text: string
}

export interface FewShotExample extends FewShotCandidate {
  readonly similarity: number
}

export interface FewShotOptions {
  /** İlk-K örnek. A8: "en benzer 2-3 dilekçe". */
  readonly maxExamples?: number
  /** Toplam bağlam bütçesi, tahmini token. */
  readonly maxContextTokens?: number
}

const DEFAULT_MAX_EXAMPLES = 3
const DEFAULT_MAX_CONTEXT_TOKENS = 2000
const CHARS_PER_TOKEN_ESTIMATE = 4

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE)
}

function tokenizeWords(text: string): ReadonlySet<string> {
  const matches = text.toLocaleLowerCase('tr').match(/\p{L}+/gu) ?? []
  return new Set(matches)
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0

  let intersection = 0
  for (const word of a) if (b.has(word)) intersection += 1

  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

/**
 * Hedef belgeye en benzer örnekleri, bağlam bütçesini aşmadan seçer.
 *
 * Bütçeyi aşan bir aday atlanır (`continue`, `break` değil) — sıradaki daha
 * küçük ama biraz daha az benzer aday yine de bütçeye sığabilir.
 */
export function selectFewShot(
  target: string,
  corpus: readonly FewShotCandidate[],
  options: FewShotOptions = {},
): readonly FewShotExample[] {
  const maxExamples = options.maxExamples ?? DEFAULT_MAX_EXAMPLES
  const maxContextTokens = options.maxContextTokens ?? DEFAULT_MAX_CONTEXT_TOKENS

  const targetWords = tokenizeWords(target)
  const ranked = corpus
    .map((candidate) => ({
      ...candidate,
      similarity: jaccard(targetWords, tokenizeWords(candidate.text)),
    }))
    .sort((a, b) => b.similarity - a.similarity)

  const selected: FewShotExample[] = []
  let usedTokens = 0

  for (const candidate of ranked) {
    if (selected.length >= maxExamples) break

    const cost = estimateTokens(candidate.text)
    if (usedTokens + cost > maxContextTokens) continue

    selected.push(candidate)
    usedTokens += cost
  }

  return selected
}
