import { describe, expect, it } from 'vitest'
import {
  FEW_SHOT_MAX_CONTEXT_TOKENS,
  FEW_SHOT_MAX_EXAMPLES,
  jaccardSimilarity,
  selectFewShot,
  type FewShotCandidate,
} from './fewshot'

describe('jaccardSimilarity (M8.5 — benzerlik ölçütü)', () => {
  it('aynı metin için 1 döner', () => {
    expect(jaccardSimilarity('kira sözleşmesi feshedildi', 'kira sözleşmesi feshedildi')).toBe(1)
  })

  it('ortak kelimesi olmayan metinlerde 0 döner', () => {
    expect(jaccardSimilarity('kira sözleşmesi', 'iş akdi')).toBe(0)
  })

  it('kısmi örtüşmede 0 ile 1 arasında değer döner', () => {
    const sim = jaccardSimilarity('kira sözleşmesi feshedildi', 'kira sözleşmesi devam ediyor')
    expect(sim).toBeGreaterThan(0)
    expect(sim).toBeLessThan(1)
  })

  it('büyük/küçük harf ve noktalamadan etkilenmez', () => {
    const a = jaccardSimilarity('Kira Sözleşmesi, feshedildi.', 'kira sözleşmesi feshedildi')
    expect(a).toBe(1)
  })

  it('boş metinde 0 döner, çökmez', () => {
    expect(jaccardSimilarity('', 'kira sözleşmesi')).toBe(0)
    expect(jaccardSimilarity('kira sözleşmesi', '')).toBe(0)
  })
})

describe('selectFewShot (M8.5)', () => {
  const corpus: readonly FewShotCandidate[] = [
    { documentId: 'a', paragraph: 'Kira sözleşmesi davalı tarafından feshedilmiştir.' },
    { documentId: 'b', paragraph: 'Kira sözleşmesi süresinde feshedilmiş ve tahliye istenmiştir.' },
    { documentId: 'c', paragraph: 'İş akdi haksız yere feshedilmiş, tazminat talep edilmiştir.' },
    { documentId: 'd', paragraph: 'Trafik kazası nedeniyle maddi ve manevi tazminat talep edilmektedir.' },
  ]

  it('en benzer adayları benzerliğe göre azalan sırada döner', () => {
    const result = selectFewShot('Kira sözleşmesi feshedilmiştir, tahliye talep edilmektedir.', corpus)
    expect(result[0]?.documentId).toBe('a')
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1]!.similarity).toBeGreaterThanOrEqual(result[i]!.similarity)
    }
  })

  it('varsayılan olarak en fazla FEW_SHOT_MAX_EXAMPLES örnek döner', () => {
    const result = selectFewShot('Kira sözleşmesi feshedilmiştir.', corpus)
    expect(result.length).toBeLessThanOrEqual(FEW_SHOT_MAX_EXAMPLES)
  })

  it('sıfır benzerlikli adayı hiç seçmez', () => {
    const result = selectFewShot('Kira sözleşmesi feshedilmiştir.', [
      { documentId: 'x', paragraph: 'Tamamen alakasız içerik zzz qqq' },
    ])
    expect(result).toEqual([])
  })

  it('bağlam bütçesini aşmaz', () => {
    const bigCorpus: FewShotCandidate[] = Array.from({ length: 10 }, (_, i) => ({
      documentId: String(i),
      paragraph: `kira sözleşmesi feshedildi ${'dolgu metni '.repeat(300)}`,
    }))
    const result = selectFewShot('kira sözleşmesi feshedildi', bigCorpus)
    const totalChars = result.reduce((sum, r) => sum + r.paragraph.length, 0)
    expect(Math.ceil(totalChars / 4)).toBeLessThanOrEqual(FEW_SHOT_MAX_CONTEXT_TOKENS)
  })

  it('özel limit ve bütçe verilirse onları kullanır', () => {
    const result = selectFewShot('Kira sözleşmesi feshedilmiştir.', corpus, {
      maxExamples: 1,
      maxContextTokens: 100000,
    })
    expect(result).toHaveLength(1)
  })

  it('boş corpus ile boş sonuç döner, çökmez', () => {
    expect(selectFewShot('herhangi bir metin', [])).toEqual([])
  })
})
