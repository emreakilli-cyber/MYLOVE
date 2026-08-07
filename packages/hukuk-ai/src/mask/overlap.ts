/**
 * Çakışan aralıkların çözümü — `docs/SPEC.md` §6.1, plan M2.8.
 *
 * Sıra: (1) uzun olan kazanır, (2) eşitse öncelik tablosu, (3) o da eşitse
 * metinde önce başlayan. Kural açık ve deterministik olmak zorunda; "hangi
 * dedektör önce koştu" gibi örtük bir sıraya bırakılamaz.
 */

import { TYPE_PRIORITY, type EntitySpan } from '../types/entities'

function compare(a: EntitySpan, b: EntitySpan): number {
  const lengthDiff = b.end - b.start - (a.end - a.start)
  if (lengthDiff !== 0) return lengthDiff

  const priorityDiff = TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type]
  if (priorityDiff !== 0) return priorityDiff

  return a.start - b.start
}

/**
 * Kesişmeyen bir alt küme seçer ve metindeki sırasına göre döndürür.
 * Kesişme tanımı: `a.start < b.end && b.start < a.end` (uç uca değme çakışma
 * sayılmaz).
 */
export function resolveOverlaps(spans: readonly EntitySpan[]): readonly EntitySpan[] {
  const ranked = [...spans].sort(compare)
  const accepted: EntitySpan[] = []

  for (const candidate of ranked) {
    const collides = accepted.some(
      (chosen) => candidate.start < chosen.end && chosen.start < candidate.end,
    )
    if (!collides) accepted.push(candidate)
  }

  return accepted.sort((a, b) => a.start - b.start)
}
