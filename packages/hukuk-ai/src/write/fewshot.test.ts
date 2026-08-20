import { describe, expect, it } from 'vitest'
import { type FewShotCandidate, selectFewShot } from './fewshot'

const TARGET = 'İşçi haksız yere işten çıkarıldı, kıdem ve ihbar tazminatı talep ediyor.'

const CORPUS: readonly FewShotCandidate[] = [
  { id: 'iş-1', text: 'İşçi haksız yere işten çıkarıldı, kıdem tazminatı ödenmedi.' },
  { id: 'kira-1', text: 'Kiracı kira bedelini ödemedi, tahliye talep edilmektedir.' },
  { id: 'iş-2', text: 'İşten çıkarma haksızdı, ihbar tazminatı talep edilmektedir.' },
  { id: 'boşanma-1', text: 'Taraflar arasında evlilik birliği temelinden sarsılmıştır.' },
]

describe('selectFewShot (M8.5)', () => {
  it('en benzer örnekleri önce sıralar', () => {
    const result = selectFewShot(TARGET, CORPUS)
    expect(result[0]?.id).toBe('iş-1')
    expect(result.map((r) => r.id)).not.toContain('boşanma-1')
  })

  it('maxExamples uygulanır', () => {
    const result = selectFewShot(TARGET, CORPUS, { maxExamples: 1 })
    expect(result).toHaveLength(1)
  })

  it('bağlam bütçesini aşan aday atlanır, daha küçük aday yerine seçilir', () => {
    const huge: FewShotCandidate = {
      id: 'huge',
      text: `İşçi haksız yere işten çıkarıldı. ${'dolgu metni '.repeat(2000)}`,
    }
    const result = selectFewShot(TARGET, [huge, ...CORPUS], {
      maxExamples: 4,
      maxContextTokens: 200,
    })

    expect(result.map((r) => r.id)).not.toContain('huge')
    expect(result.length).toBeGreaterThan(0)
  })

  it('boş korpusta boş dizi döner, çökmez', () => {
    expect(selectFewShot(TARGET, [])).toEqual([])
  })

  it('benzerlik oranı hesaplanır ve döner', () => {
    const result = selectFewShot(TARGET, CORPUS, { maxExamples: 1 })
    expect(result[0]?.similarity).toBeGreaterThan(0)
    expect(result[0]?.similarity).toBeLessThanOrEqual(1)
  })
})
