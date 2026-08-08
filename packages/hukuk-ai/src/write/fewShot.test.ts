import { describe, expect, it } from 'vitest'
import { estimateTokens, type FewShotCandidate, selectFewShot } from './fewShot'

const QUERY = 'davalı işveren haksız yere işten çıkarmıştır kıdem tazminatı talep ediyoruz'

const CANDIDATES: readonly FewShotCandidate[] = [
  {
    id: 'benzer-1',
    text: 'davalı işveren müvekkilimi haksız yere işten çıkarmıştır, kıdem tazminatı talep ediyoruz',
  },
  {
    id: 'benzer-2',
    text: 'davalı işveren işten çıkarma sürecinde usulsüz davranmış, kıdem tazminatı ödenmemiştir',
  },
  {
    id: 'alakasız',
    text: 'taraflar arasında kira sözleşmesi feshi ve tahliye talebi bulunmaktadır',
  },
]

describe('estimateTokens (M8.5)', () => {
  it('karakter uzunluğuna göre kaba tahmin verir', () => {
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('a'.repeat(400))).toBe(100)
  })

  it('boş metinde sıfır döner', () => {
    expect(estimateTokens('')).toBe(0)
  })
})

describe('selectFewShot (M8.5)', () => {
  it('en benzer adayları benzerliğe göre sıralı seçer', () => {
    const selection = selectFewShot(QUERY, CANDIDATES)
    expect(selection.examples[0]?.id).toBe('benzer-1')
    expect(selection.examples.map((example) => example.id)).not.toContain('alakasız')
  })

  it('varsayılan olarak en fazla 3 örnek seçer', () => {
    const many: FewShotCandidate[] = Array.from({ length: 10 }, (_, index) => ({
      id: `aday-${index}`,
      text: QUERY,
    }))
    const selection = selectFewShot(QUERY, many)
    expect(selection.examples.length).toBeLessThanOrEqual(3)
  })

  it('maxExamples ile sınır değiştirilebilir', () => {
    const selection = selectFewShot(QUERY, CANDIDATES, { maxExamples: 1 })
    expect(selection.examples).toHaveLength(1)
  })

  it('bağlam bütçesini (varsayılan 2.000 token) aşmaz', () => {
    const huge: FewShotCandidate = { id: 'dev', text: QUERY.repeat(400) }
    const selection = selectFewShot(QUERY, [huge, CANDIDATES[0]!])
    expect(selection.estimatedTokens).toBeLessThanOrEqual(2000)
    // Bütçeye sığmayan büyük aday atlanır, küçük ve benzer aday yine de seçilir.
    expect(selection.examples.map((example) => example.id)).toContain('benzer-1')
  })

  it('düşük bütçede hiçbir aday sığmazsa boş seçim döner, çökmez', () => {
    const selection = selectFewShot(QUERY, CANDIDATES, { maxTokens: 1 })
    expect(selection.examples).toEqual([])
    expect(selection.estimatedTokens).toBe(0)
  })

  it('sıfır benzerlikli aday listeye girmez', () => {
    const selection = selectFewShot(QUERY, [CANDIDATES[2]!])
    expect(selection.examples).toEqual([])
  })

  it('boş aday listesinde çökmez', () => {
    expect(selectFewShot(QUERY, [])).toEqual({ examples: [], estimatedTokens: 0 })
  })
})
