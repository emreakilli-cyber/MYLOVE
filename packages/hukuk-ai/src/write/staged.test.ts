import { describe, expect, it } from 'vitest'
import {
  type ConsistencyReport,
  type DocumentOutline,
  generateStaged,
  type SectionSummary,
  type WriteBackend,
} from './staged'

const OUTLINE: DocumentOutline = {
  sections: [
    { heading: 'AÇIKLAMALAR', factRefs: ['olgu-1', 'olgu-2'] },
    { heading: 'HUKUKİ SEBEPLER', factRefs: ['olgu-3'] },
    { heading: 'SONUÇ VE İSTEM', factRefs: [] },
  ],
}

function makeSpyBackend(): { backend: WriteBackend; calls: Record<string, unknown[]> } {
  const calls: Record<string, unknown[]> = {
    generateOutline: [],
    generateSection: [],
    summarizeSection: [],
    reviewConsistency: [],
  }

  const backend: WriteBackend = {
    id: 'spy',
    runsLocally: true,
    generateOutline: (request) => {
      calls.generateOutline!.push(request)
      return OUTLINE
    },
    generateSection: (request) => {
      calls.generateSection!.push(request)
      return `metin: ${request.section.heading}`
    },
    summarizeSection: (section) => {
      calls.summarizeSection!.push(section)
      return `özet: ${section.heading}`
    },
    reviewConsistency: (summaries) => {
      calls.reviewConsistency!.push(summaries)
      return { issues: [] }
    },
  }

  return { backend, calls }
}

describe('generateStaged (M8.7, A13 — iskelet → bölüm bölüm → tutarlılık)', () => {
  it('iskeleti bir kez üretir', async () => {
    const { backend, calls } = makeSpyBackend()
    await generateStaged('olay özeti', backend)
    expect(calls.generateOutline).toHaveLength(1)
  })

  it('her bölümü BAĞIMSIZ üretir — hiçbir çağrı diğer bölümleri görmez', async () => {
    const { backend, calls } = makeSpyBackend()
    await generateStaged('olay özeti', backend)

    expect(calls.generateSection).toHaveLength(OUTLINE.sections.length)
    const seenHeadings = (calls.generateSection as { section: { heading: string } }[]).map(
      (call) => call.section.heading,
    )
    expect(seenHeadings).toEqual(OUTLINE.sections.map((section) => section.heading))
  })

  it('tutarlılık geçişi TAM METNİ değil, yalnız özetleri görür', async () => {
    const { backend, calls } = makeSpyBackend()
    const result = await generateStaged('olay özeti', backend)

    expect(calls.summarizeSection).toHaveLength(OUTLINE.sections.length)
    const summaries = calls.reviewConsistency![0] as SectionSummary[]
    expect(summaries).toHaveLength(OUTLINE.sections.length)
    for (const summary of summaries) {
      expect(Object.keys(summary).sort()).toEqual(['heading', 'summary'])
      expect(summary.summary).toContain('özet:')
    }
    expect(result.consistency).toEqual<ConsistencyReport>({ issues: [] })
  })

  it('üretilen bölümlerin metnini ve başlığını doğru eşler', async () => {
    const { backend } = makeSpyBackend()
    const result = await generateStaged('olay özeti', backend)

    expect(result.sections).toEqual([
      { heading: 'AÇIKLAMALAR', text: 'metin: AÇIKLAMALAR' },
      { heading: 'HUKUKİ SEBEPLER', text: 'metin: HUKUKİ SEBEPLER' },
      { heading: 'SONUÇ VE İSTEM', text: 'metin: SONUÇ VE İSTEM' },
    ])
  })

  it('bölümsüz iskelette generateSection hiç çağrılmaz', async () => {
    const { backend, calls } = makeSpyBackend()
    backend.generateOutline = () => ({ sections: [] })

    const result = await generateStaged('olay özeti', backend)

    expect(calls.generateSection).toHaveLength(0)
    expect(result.sections).toEqual([])
  })

  it('async backend ile de çalışır', async () => {
    const asyncBackend: WriteBackend = {
      id: 'async-spy',
      runsLocally: true,
      generateOutline: async () => OUTLINE,
      generateSection: async (request) => `metin: ${request.section.heading}`,
      summarizeSection: async (section) => `özet: ${section.heading}`,
      reviewConsistency: async () => ({ issues: [] }),
    }

    const result = await generateStaged('olay özeti', asyncBackend)
    expect(result.sections).toHaveLength(3)
  })
})
