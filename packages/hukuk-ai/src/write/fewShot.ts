/**
 * Few-shot seçimi — plan M8.5, `docs/CAPABILITIES.md` A8/A9.
 *
 * "En benzer 2–3 dilekçeyi bağlama koyma; benzerlik ölçütü ve bağlam bütçesi
 * (≤ 2.000 token) belgelenmiş." Seçim BELGE düzeyindedir — bir dilekçenin
 * `StyleProfile.excerpts`'teki 2–3 temsilî paragrafı bir bütün olarak seçilir
 * ya da hiç seçilmez; tek bir belgeden parça parça karışık alıntı yapılmaz.
 *
 * Benzerlik ölçütü: sorgu ile belge alıntılarının birleşik kelime kümesi
 * arasında Jaccard benzerliği. Model gerekmez — deterministik, tekrarlanabilir.
 * Bağlam bütçesi: ~4 karakter ≈ 1 token kaba tahmini (SPEC'teki token
 * tahminiyle aynı ilke); bütçeyi aşan adaylar SESSİZCE atılmaz,
 * `droppedForBudget` alanında sayılır.
 */

import type { RepresentativeExcerpt } from './styleProfile'
import { wordSet } from './textStats'

export interface FewShotOptions {
  /** En benzer kaç dilekçe seçilecek — varsayılan 3. */
  readonly k?: number
  /** Toplam bağlam bütçesi (token) — varsayılan 2.000. */
  readonly maxTokens?: number
}

export interface FewShotSelection {
  /** Seçilen dilekçelerin temsilî paragrafları, belge sırası korunur. */
  readonly excerpts: readonly RepresentativeExcerpt[]
  readonly estimatedTokens: number
  /** Benzerlik sıralamasında yer alıp bütçe yüzünden elenen dilekçe sayısı. */
  readonly droppedForBudget: number
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const word of a) if (b.has(word)) intersection += 1
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

/** Kaba token tahmini: ~4 karakter ≈ 1 token. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function groupByDocument(
  excerpts: readonly RepresentativeExcerpt[],
): ReadonlyMap<string, readonly RepresentativeExcerpt[]> {
  const groups = new Map<string, RepresentativeExcerpt[]>()
  for (const excerpt of excerpts) {
    const list = groups.get(excerpt.documentId)
    if (list) list.push(excerpt)
    else groups.set(excerpt.documentId, [excerpt])
  }
  return groups
}

/**
 * Yeni taslağın bağlamı (`query`) ile en benzer dilekçeleri seçer.
 *
 * Sıralama: benzerlik skoru düşükten yükseğe değil, yüksekten düşüğe;
 * eşitlikte `documentId` alfabetik — sonuç her zaman tekrarlanabilir.
 */
export function selectFewShot(
  query: string,
  excerpts: readonly RepresentativeExcerpt[],
  options: FewShotOptions = {},
): FewShotSelection {
  const k = options.k ?? 3
  const maxTokens = options.maxTokens ?? 2000
  const queryWords = wordSet(query)

  const ranked = [...groupByDocument(excerpts).entries()]
    .map(([documentId, docExcerpts]) => ({
      documentId,
      docExcerpts,
      score: jaccard(queryWords, wordSet(docExcerpts.map((e) => e.text).join(' '))),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.documentId.localeCompare(b.documentId, 'tr'))
    .slice(0, k)

  const selected: RepresentativeExcerpt[] = []
  let estimatedTokens = 0
  let droppedForBudget = 0

  for (const { docExcerpts } of ranked) {
    const cost = docExcerpts.reduce((sum, excerpt) => sum + estimateTokens(excerpt.text), 0)
    if (estimatedTokens + cost > maxTokens) {
      droppedForBudget += 1
      continue
    }
    selected.push(...docExcerpts)
    estimatedTokens += cost
  }

  return { excerpts: selected, estimatedTokens, droppedForBudget }
}
