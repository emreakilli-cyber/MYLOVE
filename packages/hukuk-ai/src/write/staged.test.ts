import { describe, expect, it } from 'vitest'
import { buildStyleProfile } from './style'
import {
  type ConsistencyReport,
  type OutlineSection,
  produceStaged,
  type SectionContext,
  type StagedWriteBackend,
} from './staged'

const STYLE = buildStyleProfile('I. OLAY\nKısa bir olay metni burada yer alır.')

function fakeBackend(outline: readonly OutlineSection[]): {
  backend: StagedWriteBackend
  seenSectionContexts: SectionContext[]
  seenSummaries: readonly string[][]
} {
  const seenSectionContexts: SectionContext[] = []
  const seenSummaries: string[][] = []

  const backend: StagedWriteBackend = {
    id: 'fake',
    runsLocally: true,
    planOutline: async () => outline,
    writeSection: async (context) => {
      seenSectionContexts.push(context)
      return `${context.heading} metni — olgu: ${context.factRefs.join(', ')}`
    },
    reviewConsistency: async (summaries) => {
      seenSummaries.push([...summaries])
      return { issues: [] }
    },
  }

  return { backend, seenSectionContexts, seenSummaries }
}

describe('produceStaged (M8.7)', () => {
  const outline: OutlineSection[] = [
    { heading: 'OLAY', factRefs: ['olgu-1'] },
    { heading: 'HUKUKİ SEBEPLER', factRefs: ['olgu-2', 'olgu-3'] },
    { heading: 'SONUÇ VE İSTEM', factRefs: [] },
  ]

  it('iskeleti planlar, bölüm bölüm üretir, tutarlılık geçişi yapar', async () => {
    const { backend } = fakeBackend(outline)
    const document = await produceStaged('olay özeti', STYLE, backend)

    expect(document.outline).toEqual(outline)
    expect(document.sections).toHaveLength(3)
    expect(document.sections[0]?.heading).toBe('OLAY')
    expect(document.consistency).toEqual<ConsistencyReport>({ issues: [] })
  })

  it('her bölüm YALNIZ kendi bağlamını görür — önceki bölümün tam metni sızmaz', async () => {
    const { backend, seenSectionContexts } = fakeBackend(outline)
    await produceStaged('olay özeti', STYLE, backend)

    expect(seenSectionContexts).toHaveLength(3)
    expect(seenSectionContexts[0]?.heading).toBe('OLAY')
    expect(seenSectionContexts[1]?.heading).toBe('HUKUKİ SEBEPLER')
    // İkinci bölümün bağlamında birinci bölümün ürettiği metin YOK.
    expect(JSON.stringify(seenSectionContexts[1])).not.toContain('OLAY metni')
  })

  it('tutarlılık geçişi TAM bölüm metinlerini değil, kısa özetleri görür', async () => {
    const { backend, seenSummaries } = fakeBackend(outline)
    await produceStaged('olay özeti', STYLE, backend)

    const summaries = seenSummaries[0] ?? []
    expect(summaries).toHaveLength(3)
    for (const summary of summaries) {
      expect(summary.length).toBeLessThan(120)
    }
  })

  it('bölüm tamamlanınca onSectionComplete sırayla çağrılır', async () => {
    const { backend } = fakeBackend(outline)
    const calls: Array<{ heading: string; index: number; total: number }> = []

    await produceStaged('olay özeti', STYLE, backend, {
      onSectionComplete: (section, index, total) => {
        calls.push({ heading: section.heading, index, total })
      },
    })

    expect(calls).toEqual([
      { heading: 'OLAY', index: 0, total: 3 },
      { heading: 'HUKUKİ SEBEPLER', index: 1, total: 3 },
      { heading: 'SONUÇ VE İSTEM', index: 2, total: 3 },
    ])
  })

  it('fewShotCorpus verilirse bölüm bağlamına örnek eklenir', async () => {
    const { backend, seenSectionContexts } = fakeBackend([outline[0] as OutlineSection])

    await produceStaged('olay özeti', STYLE, backend, {
      fewShotCorpus: [{ id: 'örnek-1', text: 'olgu-1 ile ilgili benzer bir metin' }],
    })

    expect(seenSectionContexts[0]?.fewShotExamples.length).toBeGreaterThan(0)
  })

  it('outline boşsa hiç bölüm üretilmez, tutarlılık geçişi boş özetle çalışır', async () => {
    const { backend, seenSummaries } = fakeBackend([])
    const document = await produceStaged('olay özeti', STYLE, backend)

    expect(document.sections).toEqual([])
    expect(seenSummaries[0]).toEqual([])
  })
})
