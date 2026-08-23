import { describe, expect, it } from 'vitest'
import {
  checkNumberingConsistency,
  ConsistencyReviewInputTooLongError,
  CONSISTENCY_PASS_MAX_TOKENS,
  planSkeleton,
  reviewNarrativeConsistency,
  SkeletonPlanningInputTooLongError,
  SKELETON_MAX_CONTEXT_TOKENS,
  writeSections,
  type ConsistencyIssue,
  type ConsistencyReviewer,
  type DocumentPlan,
  type GeneratedSection,
  type SectionSummary,
  type SectionWriter,
  type SkeletonPlanner,
  type SkeletonPlanningContext,
} from './generate'
import { emptyStyleProfile } from './style'

const STYLE = emptyStyleProfile()

describe('planSkeleton (M8.7 — aşama 1: iskelet)', () => {
  const plan: DocumentPlan = { sections: [{ title: 'GİRİŞ', factRefs: ['f1'] }] }
  const planner: SkeletonPlanner = { id: 'test', runsLocally: true, plan: () => plan }

  it('bütçe içindeki olay özetiyle planı döner', async () => {
    const context: SkeletonPlanningContext = { caseSummary: 'kısa olay özeti', styleProfile: STYLE }
    await expect(planSkeleton(context, planner)).resolves.toBe(plan)
  })

  it('bütçeyi aşan olay özetini modele göndermeden reddeder', async () => {
    let called = false
    const spy: SkeletonPlanner = {
      id: 'spy',
      runsLocally: true,
      plan: () => {
        called = true
        return plan
      },
    }
    const tooLong: SkeletonPlanningContext = {
      caseSummary: 'x'.repeat((SKELETON_MAX_CONTEXT_TOKENS + 1) * 4),
      styleProfile: STYLE,
    }
    await expect(planSkeleton(tooLong, spy)).rejects.toThrow(SkeletonPlanningInputTooLongError)
    expect(called).toBe(false)
  })
})

describe('writeSections (M8.7 — aşama 2: bölüm bölüm, bağımsız)', () => {
  it('her bölümü bağımsız yazar; bir bölüm diğerinin metnini asla görmez', async () => {
    const seenTitles: string[] = []
    const writer: SectionWriter = {
      id: 'spy',
      runsLocally: true,
      writeSection: (context) => {
        seenTitles.push(context.section.title)
        // context içinde başka bölümlerin metnine erişim YOK — tip imzası
        // zaten bunu engelliyor; burada yalnız kendi başlığını görmesini
        // doğruluyoruz.
        return `metin: ${context.section.title}`
      },
    }

    const plan: DocumentPlan = {
      sections: [
        { title: 'GİRİŞ', factRefs: [] },
        { title: 'AÇIKLAMALAR', factRefs: [] },
        { title: 'SONUÇ VE İSTEM', factRefs: [] },
      ],
    }

    const result = await writeSections(plan, STYLE, new Map(), writer)

    expect(result).toEqual([
      { title: 'GİRİŞ', text: 'metin: GİRİŞ' },
      { title: 'AÇIKLAMALAR', text: 'metin: AÇIKLAMALAR' },
      { title: 'SONUÇ VE İSTEM', text: 'metin: SONUÇ VE İSTEM' },
    ])
    expect(seenTitles.sort()).toEqual(['AÇIKLAMALAR', 'GİRİŞ', 'SONUÇ VE İSTEM'])
  })

  it('bölüme atanan few-shot örnekleri doğru eşlenir', async () => {
    const received: Array<readonly unknown[]> = []
    const writer: SectionWriter = {
      id: 'spy',
      runsLocally: true,
      writeSection: (context) => {
        received.push(context.fewShot)
        return ''
      },
    }
    const plan: DocumentPlan = { sections: [{ title: 'GİRİŞ', factRefs: [] }] }
    const fewShot = new Map([
      ['GİRİŞ', [{ documentId: 'a', paragraph: 'örnek', similarity: 0.9 }]],
    ])

    await writeSections(plan, STYLE, fewShot, writer)
    expect(received[0]).toEqual([{ documentId: 'a', paragraph: 'örnek', similarity: 0.9 }])
  })

  it('boş planda boş sonuç döner', async () => {
    const writer: SectionWriter = { id: 'noop', runsLocally: true, writeSection: () => '' }
    expect(await writeSections({ sections: [] }, STYLE, new Map(), writer)).toEqual([])
  })
})

describe('checkNumberingConsistency (M8.7 — aşama 3a: deterministik)', () => {
  it('tüm bölümler aynı numaralandırma biçimini kullanıyorsa sorun bulmaz', () => {
    const sections: GeneratedSection[] = [
      { title: 'GİRİŞ', text: '1. birinci madde\n2. ikinci madde' },
      { title: 'SONUÇ', text: '1. talep\n2. talep' },
    ]
    expect(checkNumberingConsistency(sections)).toEqual([])
  })

  it('farklı biçimler karışıksa uyarır', () => {
    const sections: GeneratedSection[] = [
      { title: 'GİRİŞ', text: '1. birinci madde\n2. ikinci madde' },
      { title: 'HUKUKİ SEBEPLER', text: 'a) ilk\nb) ikinci' },
    ]
    const issues = checkNumberingConsistency(sections)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.kind).toBe('numbering')
    expect(issues[0]?.sectionTitles).toEqual(['GİRİŞ', 'HUKUKİ SEBEPLER'])
  })

  it('numaralandırma içermeyen bölümleri yok sayar', () => {
    const sections: GeneratedSection[] = [
      { title: 'GİRİŞ', text: 'Serbest metin, madde yok.' },
      { title: 'SONUÇ', text: '1. talep\n2. talep' },
    ]
    expect(checkNumberingConsistency(sections)).toEqual([])
  })

  it('boş bölüm listesinde sorun bulmaz', () => {
    expect(checkNumberingConsistency([])).toEqual([])
  })
})

describe('reviewNarrativeConsistency (M8.7 — aşama 3b: özet üzerinde tek pencere)', () => {
  const issue: ConsistencyIssue = { kind: 'narrative', detail: 'çelişki var', sectionTitles: ['GİRİŞ'] }
  const reviewer: ConsistencyReviewer = { id: 'test', runsLocally: true, review: () => [issue] }

  it('bütçe içindeki özetlerle backend sonucunu döner', async () => {
    const summaries: SectionSummary[] = [{ title: 'GİRİŞ', summary: 'kısa özet' }]
    await expect(reviewNarrativeConsistency(summaries, reviewer)).resolves.toEqual([issue])
  })

  it('TAM METİN değil özet aldığı için 12 bölümlük kısa özet bütçeye sığar', async () => {
    const summaries: SectionSummary[] = Array.from({ length: 12 }, (_, i) => ({
      title: `Bölüm ${i}`,
      summary: 'Kısa bir özet cümlesi.',
    }))
    await expect(reviewNarrativeConsistency(summaries, reviewer)).resolves.toEqual([issue])
  })

  it('bütçeyi aşan özet girdisini modele göndermeden reddeder', async () => {
    let called = false
    const spy: ConsistencyReviewer = {
      id: 'spy',
      runsLocally: true,
      review: () => {
        called = true
        return []
      },
    }
    const summaries: SectionSummary[] = [
      { title: 'GİRİŞ', summary: 'x'.repeat((CONSISTENCY_PASS_MAX_TOKENS + 1) * 4) },
    ]
    await expect(reviewNarrativeConsistency(summaries, spy)).rejects.toThrow(
      ConsistencyReviewInputTooLongError,
    )
    expect(called).toBe(false)
  })
})
