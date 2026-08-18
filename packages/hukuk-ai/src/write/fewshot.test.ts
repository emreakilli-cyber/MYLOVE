import { describe, expect, it } from 'vitest'
import { DEFAULT_FEW_SHOT_COUNT, FEW_SHOT_CHAR_BUDGET, jaccardSimilarity, selectFewShot } from './fewshot'

describe('jaccardSimilarity', () => {
  it('aynı metin için 1 döner', () => {
    expect(jaccardSimilarity('kira sözleşmesi feshi', 'kira sözleşmesi feshi')).toBe(1)
  })

  it('ortak kelimesi olmayan metinler için 0 döner', () => {
    expect(jaccardSimilarity('kira sözleşmesi', 'trafik kazası tazminatı')).toBe(0)
  })

  it('boş metin için 0 döner, çökmez', () => {
    expect(jaccardSimilarity('', 'kira sözleşmesi')).toBe(0)
    expect(jaccardSimilarity('kira sözleşmesi', '')).toBe(0)
  })

  it('kısmi örtüşmede 0 ile 1 arası değer döner', () => {
    const similarity = jaccardSimilarity('kira sözleşmesi feshi davası', 'kira artışı uyuşmazlığı davası')
    expect(similarity).toBeGreaterThan(0)
    expect(similarity).toBeLessThan(1)
  })
})

describe('selectFewShot (M8.5)', () => {
  const target = 'müvekkil kiracı, kira sözleşmesinin feshini talep ediyor'
  const corpus = [
    { id: 'kira-1', text: 'kira sözleşmesi feshi hakkında dilekçe, kiracı tahliye talebi' },
    { id: 'trafik-1', text: 'trafik kazası sonucu maddi ve manevi tazminat talebi' },
    { id: 'kira-2', text: 'kira artışı uyuşmazlığı, kira bedelinin tespiti talebi' },
    { id: 'is-1', text: 'işçi alacakları, kıdem ve ihbar tazminatı talebi' },
  ]

  it('en benzer örnekleri benzerlik sırasına göre seçer', () => {
    const selection = selectFewShot(target, corpus)
    expect(selection.examples[0]?.id).toBe('kira-1')
    expect(selection.examples.map((e) => e.similarity)).toEqual(
      [...selection.examples.map((e) => e.similarity)].sort((a, b) => b - a),
    )
  })

  it('varsayılan olarak en fazla 2-3 örnek seçer', () => {
    const selection = selectFewShot(target, corpus)
    expect(selection.examples.length).toBeLessThanOrEqual(DEFAULT_FEW_SHOT_COUNT)
  })

  it('bağlam bütçesini asla aşmaz', () => {
    const selection = selectFewShot(target, corpus, { charBudget: 50 })
    expect(selection.usedChars).toBeLessThanOrEqual(50)
  })

  it('bütçeye sığmayan adaylar skipped listesine düşer, sessizce kaybolmaz', () => {
    const bigCorpus = [{ id: 'big', text: 'kira sözleşmesi feshi '.repeat(500) }]
    const selection = selectFewShot('kira sözleşmesi feshi', bigCorpus, { charBudget: 10 })
    expect(selection.examples).toEqual([])
    expect(selection.skipped).toHaveLength(1)
  })

  it('boş korpusta boş seçim döner, çökmez', () => {
    const selection = selectFewShot(target, [])
    expect(selection.examples).toEqual([])
    expect(selection.usedChars).toBe(0)
  })

  it('varsayılan bütçe ~2000 token karşılığıdır', () => {
    expect(FEW_SHOT_CHAR_BUDGET).toBe(8000)
  })
})
