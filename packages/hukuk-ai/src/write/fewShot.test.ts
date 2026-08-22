import { describe, expect, it } from 'vitest'
import { selectFewShot } from './fewShot'
import type { RepresentativeExcerpt } from './styleProfile'

const POOL: readonly RepresentativeExcerpt[] = [
  { documentId: 'a', text: 'Sözleşme ihlali nedeniyle müvekkilim maddi tazminat talep etmektedir.' },
  { documentId: 'a', text: 'Davalı, sözleşme gereği üstlendiği edimini yerine getirmemiştir.' },
  { documentId: 'b', text: 'Kira sözleşmesinin tahliyesi, konut ihtiyacı nedeniyle talep edilmektedir.' },
  { documentId: 'c', text: 'Trafik kazası sonucu maddi ve manevi tazminat talep edilmektedir.' },
]

describe('selectFewShot (M8.5)', () => {
  it('en benzer belgeyi en üste koyar — belge düzeyinde seçer, karışık alıntı yapmaz', () => {
    const result = selectFewShot('Sözleşme ihlali nedeniyle tazminat talebi', POOL, { k: 1 })

    expect(result.excerpts.every((e) => e.documentId === 'a')).toBe(true)
    expect(result.excerpts).toHaveLength(2)
  })

  it('k adaydan fazla belge seçmez', () => {
    const result = selectFewShot('sözleşme tazminat talep', POOL, { k: 2 })
    const documentIds = new Set(result.excerpts.map((e) => e.documentId))
    expect(documentIds.size).toBeLessThanOrEqual(2)
  })

  it('bağlam bütçesini aşan adayları sessizce atmaz, sayar', () => {
    const result = selectFewShot('sözleşme tazminat talep', POOL, { k: 3, maxTokens: 5 })
    expect(result.estimatedTokens).toBeLessThanOrEqual(5)
    expect(result.droppedForBudget).toBeGreaterThan(0)
  })

  it('hiç ortak kelime yoksa boş döner, çökmez', () => {
    const result = selectFewShot('bambaşka bir konu hakkında hiçbir ortak sözcük', [], {})
    expect(result).toEqual({ excerpts: [], estimatedTokens: 0, droppedForBudget: 0 })
  })

  it('sonuç tekrarlanabilir — aynı girdi aynı sırayı üretir', () => {
    const first = selectFewShot('sözleşme tazminat', POOL, { k: 3 })
    const second = selectFewShot('sözleşme tazminat', POOL, { k: 3 })
    expect(first).toEqual(second)
  })
})
