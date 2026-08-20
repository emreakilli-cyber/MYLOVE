import { describe, expect, it } from 'vitest'
import type { ResearchDocument } from './client'
import {
  type CorrelationBackend,
  type SummaryBackend,
  correlateResults,
  summarizeResults,
} from './correlate'

function doc(id: string): ResearchDocument {
  return { id, title: `Karar ${id}`, excerpt: `${id} gerekçesi` }
}

describe('summarizeResults (M7.6)', () => {
  it('her belgeyi tek başına özetler, sırayı korur', async () => {
    const seen: string[] = []
    const backend: SummaryBackend = {
      id: 'test',
      runsLocally: true,
      summarize: (document) => {
        seen.push(document.id)
        return `özet:${document.id}`
      },
    }

    const { results } = await summarizeResults([doc('1'), doc('2')], backend)

    expect(seen).toEqual(['1', '2'])
    expect(results).toEqual([
      { documentId: '1', summary: 'özet:1' },
      { documentId: '2', summary: 'özet:2' },
    ])
  })

  it('K sınırını aşan sonuçları eler ve bildirir', async () => {
    const backend: SummaryBackend = {
      id: 'test',
      runsLocally: true,
      summarize: (document) => document.id,
    }
    const documents = ['1', '2', '3'].map(doc)

    const { results, note } = await summarizeResults(documents, backend, { limit: 2 })

    expect(results).toHaveLength(2)
    expect(note).toContain('1 sonuç elendi')
  })
})

describe('correlateResults (M7.6) — K bağımsız kısa geçiş', () => {
  it('her aday karar olay özetiyle AYRI bir çağrıda değerlendirilir', async () => {
    const calls: Array<{ caseSummary: string; documentId: string }> = []
    const backend: CorrelationBackend = {
      id: 'test',
      runsLocally: true,
      correlate: (caseSummary, document) => {
        calls.push({ caseSummary, documentId: document.id })
        return { documentId: document.id, relevance: 0.5, rationale: 'test' }
      },
    }

    await correlateResults('[KISI_1] tazminat talebinde bulundu', [doc('1'), doc('2')], backend)

    // Backend imzası tek belge alır — birden çok kararın metnini tek çağrıda
    // birleştirmenin API'de yolu yok; bu test her çağrının tam olarak bir
    // belgeye karşılık geldiğini doğrular.
    expect(calls).toEqual([
      { caseSummary: '[KISI_1] tazminat talebinde bulundu', documentId: '1' },
      { caseSummary: '[KISI_1] tazminat talebinde bulundu', documentId: '2' },
    ])
  })

  it('ilişkilendirme sonuçları belge kimliğiyle bire bir eşleşir', async () => {
    const backend: CorrelationBackend = {
      id: 'test',
      runsLocally: true,
      correlate: (_caseSummary, document) => ({
        documentId: document.id,
        relevance: document.id === '1' ? 0.9 : 0.1,
        rationale: document.id === '1' ? 'doğrudan emsal' : 'ilgisiz',
      }),
    }

    const { results } = await correlateResults('olay özeti', [doc('1'), doc('2')], backend)

    expect(results).toEqual([
      { documentId: '1', relevance: 0.9, rationale: 'doğrudan emsal' },
      { documentId: '2', relevance: 0.1, rationale: 'ilgisiz' },
    ])
  })

  it('K sınırını aşan adayları eler ve bildirir', async () => {
    const backend: CorrelationBackend = {
      id: 'test',
      runsLocally: true,
      correlate: (_caseSummary, document) => ({
        documentId: document.id,
        relevance: 0,
        rationale: '',
      }),
    }
    const documents = ['1', '2', '3', '4'].map(doc)

    const { results, note } = await correlateResults('olay özeti', documents, backend, {
      limit: 3,
    })

    expect(results).toHaveLength(3)
    expect(note).toContain('İlk 3 sonuç')
  })

  it('K sınırının altındaysa not üretilmez', async () => {
    const backend: CorrelationBackend = {
      id: 'test',
      runsLocally: true,
      correlate: (_caseSummary, document) => ({
        documentId: document.id,
        relevance: 0,
        rationale: '',
      }),
    }

    const { note } = await correlateResults('olay özeti', [doc('1')], backend, { limit: 5 })

    expect(note).toBeUndefined()
  })
})
