import { describe, expect, it } from 'vitest'
import {
  type ConsistencyBackend,
  type ConsistencyRequest,
  type DraftOutline,
  type OutlineBackend,
  type SectionBackend,
  type SectionRequest,
  generateDraft,
} from './generate'
import type { StyleProfile } from './styleProfile'

const EMPTY_PROFILE: StyleProfile = {
  documentCount: 0,
  sentenceLength: { count: 0, mean: 0, min: 0, max: 0, stdDev: 0 },
  paragraphLength: { count: 0, mean: 0, min: 0, max: 0, stdDev: 0 },
  numberingStyle: 'none',
  formulaicPhrases: [],
  salutations: [],
  closings: [],
  citationStyle: { lawReferenceCount: 0, caseReferenceCount: 0, caseOrder: 'unknown' },
  preferredTerms: [],
  excerpts: [],
}

const OUTLINE: DraftOutline = {
  sections: [
    { heading: 'AÇIKLAMALAR', notes: ['olgu 1', 'olgu 2'] },
    { heading: 'SONUÇ VE İSTEM', notes: ['talep 1'] },
  ],
}

function outlineBackend(outline: DraftOutline = OUTLINE): OutlineBackend {
  return { id: 'test-outline', runsLocally: true, outline: async () => outline }
}

describe('generateDraft (M8.7)', () => {
  it('iskelet → bölüm bölüm → tutarlılık sırasıyla koşar', async () => {
    const calls: string[] = []
    const sectionBackend: SectionBackend = {
      id: 'test-section',
      runsLocally: true,
      async writeSection(request: SectionRequest) {
        calls.push(request.heading)
        return `metin:${request.heading}`
      },
    }
    const consistencyBackend: ConsistencyBackend = {
      id: 'test-consistency',
      runsLocally: true,
      review: async () => [],
    }

    const result = await generateDraft('olay özeti', EMPTY_PROFILE, {
      outlineBackend: outlineBackend(),
      sectionBackend,
      consistencyBackend,
    })

    expect(calls).toEqual(['AÇIKLAMALAR', 'SONUÇ VE İSTEM'])
    expect(result.sections).toEqual([
      { heading: 'AÇIKLAMALAR', text: 'metin:AÇIKLAMALAR' },
      { heading: 'SONUÇ VE İSTEM', text: 'metin:SONUÇ VE İSTEM' },
    ])
  })

  it('bölümler SIRAYLA üretilir — aynı anda iki bölüm koşmaz', async () => {
    let concurrent = 0
    let maxConcurrent = 0
    const sectionBackend: SectionBackend = {
      id: 'test-section',
      runsLocally: true,
      async writeSection(request: SectionRequest) {
        concurrent += 1
        maxConcurrent = Math.max(maxConcurrent, concurrent)
        await new Promise((resolve) => setTimeout(resolve, 5))
        concurrent -= 1
        return `metin:${request.heading}`
      },
    }

    await generateDraft('olay özeti', EMPTY_PROFILE, {
      outlineBackend: outlineBackend(),
      sectionBackend,
      consistencyBackend: { id: 'c', runsLocally: true, review: async () => [] },
    })

    expect(maxConcurrent).toBe(1)
  })

  it('tutarlılık geçişi yalnız ÖZETLERİ görür, tam bölüm metnini görmez', async () => {
    const sectionBackend: SectionBackend = {
      id: 'test-section',
      runsLocally: true,
      writeSection: async () =>
        'Birinci cümle burada. İkinci cümle burada. Üçüncü cümle asla özete girmemeli.',
    }

    let received: ConsistencyRequest | undefined
    const consistencyBackend: ConsistencyBackend = {
      id: 'test-consistency',
      runsLocally: true,
      review: async (request) => {
        received = request
        return []
      },
    }

    await generateDraft('olay özeti', EMPTY_PROFILE, {
      outlineBackend: outlineBackend({ sections: [{ heading: 'AÇIKLAMALAR', notes: [] }] }),
      sectionBackend,
      consistencyBackend,
    })

    expect(received?.sectionSummaries).toEqual([
      { heading: 'AÇIKLAMALAR', summary: 'Birinci cümle burada. İkinci cümle burada.' },
    ])
    expect(JSON.stringify(received)).not.toContain('Üçüncü cümle asla özete girmemeli')
  })

  it('resume: tamamlanmış bölüm yeniden üretilmez, kaldığı yerden sürer', async () => {
    const calls: string[] = []
    const sectionBackend: SectionBackend = {
      id: 'test-section',
      runsLocally: true,
      async writeSection(request: SectionRequest) {
        calls.push(request.heading)
        return `yeni:${request.heading}`
      },
    }

    const result = await generateDraft('olay özeti', EMPTY_PROFILE, {
      outlineBackend: outlineBackend(),
      sectionBackend,
      consistencyBackend: { id: 'c', runsLocally: true, review: async () => [] },
      resume: {
        outline: OUTLINE,
        sections: [{ heading: 'AÇIKLAMALAR', text: 'daha önce üretilmiş metin' }],
      },
    })

    expect(calls).toEqual(['SONUÇ VE İSTEM'])
    expect(result.sections).toEqual([
      { heading: 'AÇIKLAMALAR', text: 'daha önce üretilmiş metin' },
      { heading: 'SONUÇ VE İSTEM', text: 'yeni:SONUÇ VE İSTEM' },
    ])
  })

  it('bölüm isteği yalnız KENDİ notlarını taşır, diğer bölümlerin içeriğini asla almaz', async () => {
    const requests: SectionRequest[] = []
    const sectionBackend: SectionBackend = {
      id: 'test-section',
      runsLocally: true,
      async writeSection(request: SectionRequest) {
        requests.push(request)
        return 'metin'
      },
    }

    await generateDraft('olay özeti', EMPTY_PROFILE, {
      outlineBackend: outlineBackend(),
      sectionBackend,
      consistencyBackend: { id: 'c', runsLocally: true, review: async () => [] },
    })

    expect(requests[0]?.notes).toEqual(['olgu 1', 'olgu 2'])
    expect(requests[1]?.notes).toEqual(['talep 1'])
  })
})
