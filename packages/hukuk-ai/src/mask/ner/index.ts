/**
 * NER katmanı koşum sırası — plan M3.7, `docs/SPEC.md` S5.
 *
 * Kural katmanı HER ZAMAN önce koşar; NER yalnız kural katmanının dokunmadığı
 * boşluklarda çalışır. Sıra pazarlık konusu değil: kural katmanı doğrulama
 * algoritmalı ve deterministiktir, NER olasılıklıdır. Olasılıklı bir katmanın
 * doğrulanmış bir TCKN'yi "kişi adı" diye yeniden etiketlemesine izin verilmez.
 */

import type { EntitySpan } from '../../types/entities'
import type { AsyncNerBackend, FreeRegion, NerBackend, NerCandidate } from './types'

/** Kural aralıklarının dışında kalan boşluklar. */
export function freeRegions(
  textLength: number,
  taken: readonly { start: number; end: number }[],
): readonly FreeRegion[] {
  const sorted = [...taken].sort((a, b) => a.start - b.start)
  const regions: FreeRegion[] = []
  let cursor = 0

  for (const range of sorted) {
    if (range.start > cursor) regions.push({ start: cursor, end: range.start })
    cursor = Math.max(cursor, range.end)
  }
  if (cursor < textLength) regions.push({ start: cursor, end: textLength })

  return regions
}

/**
 * S5'i ZORLAR: boşlukların dışına taşan aday atılır.
 *
 * Bu denetim bilerek burada, backend'de değil. Backend'in kendi kendini
 * sınırlamasına güvenmek, sözleşmeyi iyi niyete bağlamak olurdu; kötü yazılmış
 * ya da ileride eklenecek bir model uygulaması doğrulanmış bir TCKN'yi "kişi
 * adı" diye yeniden etiketleyebilirdi.
 */
function withinRegions(
  candidates: readonly NerCandidate[],
  regions: readonly FreeRegion[],
): readonly NerCandidate[] {
  return candidates.filter((candidate) =>
    regions.some(
      (region) => candidate.start >= region.start && candidate.end <= region.end,
    ),
  )
}

export function toEntitySpans(
  text: string,
  candidates: readonly NerCandidate[],
): readonly EntitySpan[] {
  return candidates.map((candidate) => ({
    start: candidate.start,
    end: candidate.end,
    text: text.slice(candidate.start, candidate.end),
    type: candidate.type,
    layer: 'ner' as const,
    key: candidate.key ?? text.slice(candidate.start, candidate.end),
    confidence: candidate.confidence,
  }))
}

export function runNer(
  text: string,
  ruleSpans: readonly EntitySpan[],
  backend: NerBackend,
): readonly EntitySpan[] {
  const regions = freeRegions(text.length, ruleSpans)
  return toEntitySpans(text, withinRegions(backend.detect(text, regions), regions))
}

export async function runNerAsync(
  text: string,
  ruleSpans: readonly EntitySpan[],
  backend: NerBackend | AsyncNerBackend,
): Promise<readonly EntitySpan[]> {
  const regions = freeRegions(text.length, ruleSpans)
  return toEntitySpans(text, withinRegions(await backend.detect(text, regions), regions))
}

export { createDictionaryNerBackend } from './dictionary'
export type { DictionaryNerOptions } from './dictionary'
export type { AsyncNerBackend, FreeRegion, NerBackend, NerCandidate, NerEntityType } from './types'
