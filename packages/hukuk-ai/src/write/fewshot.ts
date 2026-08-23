/**
 * Few-shot seçimi — plan M8.5, `CAPABILITIES.md` A8 (c) / A9.
 *
 * Hedef bölüme en benzer 2-3 dilekçe paragrafını, bağlam bütçesi aşılmadan
 * seçer. Aday havuzu genelde `StyleProfile.sampleParagraphs`ten gelir ama bu
 * fonksiyon ona bağımlı değildir — çağıran taraf herhangi bir metin listesini
 * aday olarak verebilir.
 *
 * **Benzerlik ölçütü:** Jaccard benzerliği, normalize edilmiş kelime kümeleri
 * üzerinde (`jaccardSimilarity`). Gerekçe: paket sıfır bağımlıdır (M0.3),
 * gömme (embedding) modeli yok; kelime kümesi kesişimi ucuz, deterministik ve
 * denetlenebilir bir alt sınırdır. Cihazda gömme modeli varsa (ör. NER'in
 * yanına eklenen küçük bir encoder) bu fonksiyon değiştirilmeden `corpus`
 * öncesi bir ön-sıralama katmanı olarak eklenebilir; sözleşme bozulmaz.
 *
 * **Bağlam bütçesi:** `FEW_SHOT_MAX_CONTEXT_TOKENS` (A8.5: "≤ 2.000 token").
 * Seçim açgözlü (greedy) çalışır: benzerliğe göre sırala, bütçeyi aşmayan
 * ilk `FEW_SHOT_MAX_EXAMPLES` adayı al.
 */

import { estimateTokens } from '../shared/tokenEstimate'

/** A8.5: "en benzer 2-3 dilekçeyi bağlama koyma." */
export const FEW_SHOT_MAX_EXAMPLES = 3
/** A8.5: "bağlam bütçesi (≤ 2.000 token)." */
export const FEW_SHOT_MAX_CONTEXT_TOKENS = 2000

export interface FewShotCandidate {
  readonly documentId: string
  readonly paragraph: string
}

export interface FewShotExample extends FewShotCandidate {
  readonly similarity: number
}

function normalizeWords(text: string): ReadonlySet<string> {
  return new Set(
    text
      .toLocaleLowerCase('tr')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 0),
  )
}

/** Normalize edilmiş kelime kümeleri üzerinde Jaccard benzerliği: |A∩B| / |A∪B|. */
export function jaccardSimilarity(a: string, b: string): number {
  const wordsA = normalizeWords(a)
  const wordsB = normalizeWords(b)
  if (wordsA.size === 0 || wordsB.size === 0) return 0

  let intersection = 0
  for (const word of wordsA) if (wordsB.has(word)) intersection++

  const union = wordsA.size + wordsB.size - intersection
  return union === 0 ? 0 : intersection / union
}

export interface SelectFewShotOptions {
  readonly maxExamples?: number
  readonly maxContextTokens?: number
}

/**
 * Hedef metne en benzer adayları, bütçe içinde kalarak seçer. Sıfır benzerlik
 * (`similarity === 0`) taşıyan adaylar hiç seçilmez — alakasız örnek üretim
 * kalitesini düşürür, boş bütçe kullanmaktan kötüdür.
 */
export function selectFewShot(
  target: string,
  corpus: readonly FewShotCandidate[],
  options: SelectFewShotOptions = {},
): readonly FewShotExample[] {
  const maxExamples = options.maxExamples ?? FEW_SHOT_MAX_EXAMPLES
  const maxTokens = options.maxContextTokens ?? FEW_SHOT_MAX_CONTEXT_TOKENS

  const ranked = corpus
    .map((candidate) => ({ ...candidate, similarity: jaccardSimilarity(target, candidate.paragraph) }))
    .filter((candidate) => candidate.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity || a.documentId.localeCompare(b.documentId, 'tr'))

  const selected: FewShotExample[] = []
  let usedTokens = 0
  for (const candidate of ranked) {
    if (selected.length >= maxExamples) break
    const tokens = estimateTokens(candidate.paragraph)
    if (usedTokens + tokens > maxTokens) continue
    selected.push(candidate)
    usedTokens += tokens
  }
  return selected
}
