import { describe, expect, it } from 'vitest'
import { extractStyleProfile } from './style'
import {
  CONSISTENCY_CONTEXT_CHAR_BUDGET,
  ConsistencyContextTooLargeError,
  SECTION_CONTEXT_CHAR_BUDGET,
  SectionContextTooLargeError,
  SKELETON_PLAN_CHAR_BUDGET,
  SkeletonPlanContextTooLargeError,
  type WriteBackend,
  buildSectionPrompt,
  generateSection,
  generateSkeletonPlan,
  generateStagedDraft,
  runConsistencyPass,
} from './generate'

function makeBackend(responses: readonly string[]): WriteBackend & { calls: string[] } {
  const calls: string[] = []
  let index = 0
  return {
    calls,
    generate: (prompt: string) => {
      calls.push(prompt)
      const response = responses[index] ?? ''
      index += 1
      return response
    },
  }
}

describe('generateSkeletonPlan (M8.7 §1 — iskelet)', () => {
  it('backend çıktısını başlık listesine ayırır', async () => {
    const backend = makeBackend(['1. KONU\n2. AÇIKLAMALAR\n3. SONUÇ VE İSTEM'])
    const headings = await generateSkeletonPlan('kira davası dilekçesi', [], backend)
    expect(headings).toEqual(['1. KONU', '2. AÇIKLAMALAR', '3. SONUÇ VE İSTEM'])
  })

  it('olguları prompta ekler', async () => {
    const backend = makeBackend(['1. KONU'])
    await generateSkeletonPlan('talimat', ['kira bedeli ödenmedi'], backend)
    expect(backend.calls[0]).toContain('kira bedeli ödenmedi')
  })

  it('bütçeyi aşan talimatta backend hiç çağrılmadan hata verir', async () => {
    const hugeInstructions = 'a'.repeat(SKELETON_PLAN_CHAR_BUDGET + 1)
    const backend = makeBackend([])
    await expect(generateSkeletonPlan(hugeInstructions, [], backend)).rejects.toThrow(
      SkeletonPlanContextTooLargeError,
    )
    expect(backend.calls).toHaveLength(0)
  })

  it('boş satırları eler', async () => {
    const backend = makeBackend(['1. KONU\n\n\n2. SONUÇ\n'])
    const headings = await generateSkeletonPlan('x', [], backend)
    expect(headings).toEqual(['1. KONU', '2. SONUÇ'])
  })
})

describe('generateSection (M8.7 §2 — bölüm bölüm üretim)', () => {
  it('prompt; başlık, olgular, üslup ve few-shot örneklerini içerir', () => {
    const styleProfile = extractStyleProfile('Saygılarımla.')
    const prompt = buildSectionPrompt({
      planHeadings: ['KONU', 'SONUÇ'],
      heading: 'KONU',
      facts: ['kira bedeli 5.000 TL'],
      styleProfile,
      fewShot: [{ id: 'ör-1', text: 'örnek dilekçe metni' }],
    })

    expect(prompt).toContain('KONU')
    expect(prompt).toContain('kira bedeli 5.000 TL')
    expect(prompt).toContain('örnek dilekçe metni')
  })

  it('backend çağrısı sonucu bölüm metnini döner', async () => {
    const backend = makeBackend(['üretilen bölüm metni'])
    const section = await generateSection(
      { planHeadings: ['KONU'], heading: 'KONU', facts: [] },
      backend,
    )
    expect(section).toEqual({ heading: 'KONU', text: 'üretilen bölüm metni' })
  })

  it('bütçeyi aşan bağlamda backend hiç çağrılmaz', async () => {
    const backend = makeBackend([])
    const facts = ['a'.repeat(SECTION_CONTEXT_CHAR_BUDGET + 1)]
    await expect(
      generateSection({ planHeadings: ['KONU'], heading: 'KONU', facts }, backend),
    ).rejects.toThrow(SectionContextTooLargeError)
    expect(backend.calls).toHaveLength(0)
  })
})

describe('runConsistencyPass (M8.7 §3 — tutarlılık geçişi)', () => {
  it('bölüm ÖZETLERİ üzerinde tek geçiş yapar, tam metni değil', async () => {
    const backend = makeBackend(['Not: 1. ve 2. bölümde tarih çelişkisi var.'])
    const sections = [
      { heading: 'KONU', text: 'x'.repeat(1000) },
      { heading: 'SONUÇ', text: 'y'.repeat(1000) },
    ]
    const result = await runConsistencyPass(sections, backend)

    expect(result.notes).toEqual(['Not: 1. ve 2. bölümde tarih çelişkisi var.'])
    // Özetlenmiş bağlam, iki bölümün toplam ham metninden çok daha kısadır.
    expect(result.contextCharCount).toBeLessThan(2000)
  })

  it('çok sayıda bölümde bütçe aşılırsa backend çağrılmadan hata verir', async () => {
    const backend = makeBackend([])
    const sections = Array.from({ length: 40 }, (_, i) => ({
      heading: `Bölüm ${i} — ${'başlık '.repeat(10)}`,
      text: 'içerik '.repeat(50),
    }))

    await expect(runConsistencyPass(sections, backend)).rejects.toThrow(ConsistencyContextTooLargeError)
    expect(backend.calls).toHaveLength(0)
  })

  it('tutarlılık bütçesi ~1500 token karşılığıdır', () => {
    expect(CONSISTENCY_CONTEXT_CHAR_BUDGET).toBe(6000)
  })
})

describe('generateStagedDraft (M8.7) — üç aşamalı orkestrasyon', () => {
  it('iskelet → bölüm bölüm → tutarlılık sırasıyla çalışır', async () => {
    const backend = makeBackend([
      '1. KONU\n2. SONUÇ',
      'KONU bölümü metni',
      'SONUÇ bölümü metni',
      'çelişki bulunamadı',
    ])

    const draft = await generateStagedDraft(
      {
        instructions: 'kira davası',
        facts: ['genel olgu'],
        factsBySection: { '1. KONU': ['konuya özel olgu'], '2. SONUÇ': ['sonuca özel olgu'] },
      },
      backend,
    )

    expect(draft.headings).toEqual(['1. KONU', '2. SONUÇ'])
    expect(draft.sections).toEqual([
      { heading: '1. KONU', text: 'KONU bölümü metni' },
      { heading: '2. SONUÇ', text: 'SONUÇ bölümü metni' },
    ])
    expect(draft.consistencyNotes).toEqual(['çelişki bulunamadı'])
    expect(backend.calls).toHaveLength(4)
  })

  it('her bölüm kendi olgu altkümesini görür, diğerininkini görmez', async () => {
    const backend = makeBackend([
      '1. KONU\n2. SONUÇ',
      'metin-1',
      'metin-2',
    ])

    await generateStagedDraft(
      {
        instructions: 'dava',
        factsBySection: { '1. KONU': ['SADECE_KONU_OLGUSU'], '2. SONUÇ': ['SADECE_SONUC_OLGUSU'] },
      },
      backend,
    )

    const konuPrompt = backend.calls[1]
    const sonucPrompt = backend.calls[2]
    expect(konuPrompt).toContain('SADECE_KONU_OLGUSU')
    expect(konuPrompt).not.toContain('SADECE_SONUC_OLGUSU')
    expect(sonucPrompt).toContain('SADECE_SONUC_OLGUSU')
    expect(sonucPrompt).not.toContain('SADECE_KONU_OLGUSU')
  })
})
