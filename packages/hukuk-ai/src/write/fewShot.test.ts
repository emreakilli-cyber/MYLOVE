import { describe, expect, it } from 'vitest'
import {
  FEW_SHOT_MAX_EXAMPLES,
  FEW_SHOT_TOKEN_BUDGET,
  selectFewShotExamples,
  type FewShotCandidate,
} from './fewShot'

const QUERY = 'kira sözleşmesi tahliye kira bedeli ödenmemesi davalı kiracı'

const CANDIDATES: FewShotCandidate[] = [
  { id: 'kira-1', text: 'kira sözleşmesi tahliye kira bedeli ödenmemesi davalı kiracı temerrüt' },
  { id: 'bosanma-1', text: 'boşanma davası mal paylaşımı nafaka velayet çocuk' },
  { id: 'kira-2', text: 'kira bedeli tahliye taahhütnamesi davalı kiracı' },
]

describe('selectFewShotExamples (M8.5)', () => {
  it('en benzer adayları önce sıralar', () => {
    const selected = selectFewShotExamples(QUERY, CANDIDATES, { maxExamples: 2 })
    expect(selected.map((s) => s.id)).toEqual(['kira-1', 'kira-2'])
  })

  it('en fazla FEW_SHOT_MAX_EXAMPLES aday döner', () => {
    const many: FewShotCandidate[] = Array.from({ length: 10 }, (_, i) => ({
      id: `kira-${i}`,
      text: 'kira sözleşmesi tahliye kira bedeli ödenmemesi davalı kiracı',
    }))
    const selected = selectFewShotExamples(QUERY, many)
    expect(selected.length).toBeLessThanOrEqual(FEW_SHOT_MAX_EXAMPLES)
  })

  it('özel maxExamples uygular', () => {
    const selected = selectFewShotExamples(QUERY, CANDIDATES, { maxExamples: 1 })
    expect(selected).toHaveLength(1)
    expect(selected.at(0)?.id).toBe('kira-1')
  })

  it('toplam token bütçesini aşmaz', () => {
    const huge: FewShotCandidate = { id: 'huge', text: 'kira '.repeat(FEW_SHOT_TOKEN_BUDGET) }
    const selected = selectFewShotExamples(QUERY, [huge, ...CANDIDATES])
    const totalChars = selected.reduce((sum, s) => sum + s.text.length, 0)
    expect(Math.ceil(totalChars / 4)).toBeLessThanOrEqual(FEW_SHOT_TOKEN_BUDGET)
  })

  it('bütçeye sığmayan büyük aday atlanır, sığan daha düşük benzerlikli aday alınır', () => {
    const huge: FewShotCandidate = {
      id: 'huge',
      text: `kira sözleşmesi tahliye kira bedeli ödenmemesi davalı kiracı ${'x '.repeat(FEW_SHOT_TOKEN_BUDGET * 4)}`,
    }
    const selected = selectFewShotExamples(QUERY, [huge, ...CANDIDATES], { tokenBudget: 100 })
    expect(selected.map((s) => s.id)).not.toContain('huge')
    expect(selected.length).toBeGreaterThan(0)
  })

  it('boş aday listesinde çökmez', () => {
    expect(selectFewShotExamples(QUERY, [])).toEqual([])
  })

  it('benzerlik skorunu döndürür', () => {
    const top = selectFewShotExamples(QUERY, CANDIDATES).at(0)
    expect(top?.similarity).toBeGreaterThan(0)
    expect(top?.similarity).toBeLessThanOrEqual(1)
  })
})
