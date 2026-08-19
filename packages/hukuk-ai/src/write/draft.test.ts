import { describe, expect, it } from 'vitest'
import {
  CONSISTENCY_SUMMARY_BUDGET,
  ConsistencySummaryTooLongError,
  generateDraft,
  type DraftBackend,
  type DraftInput,
  type DraftSkeleton,
  type SectionPlan,
} from './draft'

const INPUT: DraftInput = { caseSummary: 'kira tahliye davası, kiracı temerrütte' }

const SKELETON: DraftSkeleton = {
  sections: [
    { heading: 'AÇIKLAMALAR', factRefs: ['f1'] },
    { heading: 'HUKUKİ SEBEPLER', factRefs: ['f2'] },
    { heading: 'SONUÇ VE İSTEM', factRefs: [] },
  ],
}

/** Her `writeSection` çağrısında GÖRÜLEN diğer bölümleri kaydeder — hiçbiri görmemeli. */
function recordingBackend(overrides: Partial<DraftBackend> = {}): DraftBackend & {
  writeSectionCalls: SectionPlan[]
  consistencyCalls: unknown[]
} {
  const writeSectionCalls: SectionPlan[] = []
  const consistencyCalls: unknown[] = []
  return {
    planSkeleton: async () => SKELETON,
    writeSection: async (section) => {
      writeSectionCalls.push(section)
      return {
        heading: section.heading,
        text: `${section.heading} için uzun tam metin ${'x'.repeat(200)}`,
        summary: `${section.heading} özeti`,
      }
    },
    reviewConsistency: async (summaries) => {
      consistencyCalls.push(summaries)
      return { issues: [] }
    },
    writeSectionCalls,
    consistencyCalls,
    ...overrides,
  }
}

describe('generateDraft (M8.7 — aşamalı üretim)', () => {
  it('üç aşamayı sırayla koşar: iskelet → bölüm bölüm → tutarlılık', async () => {
    const backend = recordingBackend()
    const result = await generateDraft(INPUT, backend)

    expect(result.skeleton).toEqual(SKELETON)
    expect(result.sections.map((s) => s.heading)).toEqual([
      'AÇIKLAMALAR',
      'HUKUKİ SEBEPLER',
      'SONUÇ VE İSTEM',
    ])
    expect(result.consistency).toEqual({ issues: [] })
  })

  it('her bölüm KENDİ çağrısını alır; writeSection her seferinde tek bölüm görür', async () => {
    const backend = recordingBackend()
    await generateDraft(INPUT, backend)
    expect(backend.writeSectionCalls).toHaveLength(3)
    for (const call of backend.writeSectionCalls) {
      expect(call).toHaveProperty('heading')
      expect(Array.isArray(call)).toBe(false)
    }
  })

  it('tutarlılık geçişine yalnız ÖZETLER gider, tam metin gitmez', async () => {
    const backend = recordingBackend()
    await generateDraft(INPUT, backend)

    const [summaries] = backend.consistencyCalls as [{ heading: string; summary: string }[]]
    expect(summaries).toHaveLength(3)
    for (const summary of summaries) {
      expect(summary).toEqual({ heading: summary.heading, summary: expect.any(String) })
      expect(Object.keys(summary)).toEqual(['heading', 'summary'])
      // Tam metindeki uzun dolgu tutarlılık çağrısına hiç sızmamalı.
      expect(summary.summary).not.toContain('x'.repeat(200))
    }
  })

  it('özetlerin toplamı bütçeyi aşarsa hata fırlatır, tutarlılık geçişi hiç çalışmaz', async () => {
    const backend = recordingBackend({
      writeSection: async (section) => ({
        heading: section.heading,
        text: 'kısa metin',
        summary: 'y'.repeat((CONSISTENCY_SUMMARY_BUDGET + 100) * 4),
      }),
    })

    await expect(generateDraft(INPUT, backend)).rejects.toThrow(ConsistencySummaryTooLongError)
    expect(backend.consistencyCalls).toHaveLength(0)
  })

  it('boş iskelette çökmez, boş bölüm listesiyle döner', async () => {
    const backend = recordingBackend({ planSkeleton: async () => ({ sections: [] }) })
    const result = await generateDraft(INPUT, backend)
    expect(result.sections).toEqual([])
    expect(result.consistency).toEqual({ issues: [] })
  })
})
