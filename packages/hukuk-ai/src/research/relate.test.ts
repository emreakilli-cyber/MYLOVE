import { describe, expect, it } from 'vitest'
import type { ResearchDocument } from './client'
import {
  CASE_SUMMARY_TOKEN_BUDGET,
  CaseSummaryTooLongError,
  DEFAULT_RELATE_LIMIT,
  relateDocumentsToCase,
  summarizeDocument,
  summarizeDocuments,
  type SummaryBackend,
} from './relate'

function doc(id: string, excerpt = 'karar metni'): ResearchDocument {
  return { id, title: `Karar ${id}`, excerpt }
}

/** Her çağrıda hangi kararların birlikte göründüğünü kaydeder. */
function recordingBackend(): SummaryBackend & { calls: ResearchDocument[][] } {
  const calls: ResearchDocument[][] = []
  return {
    calls,
    summarizeDocument: (document) => {
      calls.push([document])
      return { documentId: document.id, summary: `özet:${document.id}` }
    },
    relateToCase: (document, caseSummary) => {
      calls.push([document])
      return { documentId: document.id, relevant: caseSummary.length > 0, rationale: 'test' }
    },
  }
}

describe('summarizeDocument / summarizeDocuments (M7.6)', () => {
  it('tek kararı özetler', async () => {
    const backend = recordingBackend()
    const result = await summarizeDocument(doc('1'), backend)
    expect(result).toEqual({ documentId: '1', summary: 'özet:1' })
  })

  it('birden çok kararı, birbirinden bağımsız özetler', async () => {
    const backend = recordingBackend()
    const results = await summarizeDocuments([doc('1'), doc('2'), doc('3')], backend)

    expect(results.map((r) => r.documentId)).toEqual(['1', '2', '3'])
    // Her çağrı TEK karar taşımalı — hiçbir çağrıda birden fazla karar birlikte yok.
    for (const call of backend.calls) expect(call).toHaveLength(1)
  })

  it('K sınırını uygular — kalan kararlar hiç işlenmez', async () => {
    const backend = recordingBackend()
    const documents = [doc('1'), doc('2'), doc('3'), doc('4')]
    const results = await summarizeDocuments(documents, backend, { limit: 2 })

    expect(results).toHaveLength(2)
    expect(backend.calls).toHaveLength(2)
  })
})

describe('relateDocumentsToCase (M7.6 — K bağımsız kısa geçiş)', () => {
  it('her kararı olay özetiyle AYRI AYRI ilişkilendirir', async () => {
    const backend = recordingBackend()
    const documents = [doc('1'), doc('2'), doc('3')]
    const results = await relateDocumentsToCase(documents, 'olay özeti', backend)

    expect(results.map((r) => r.documentId)).toEqual(['1', '2', '3'])
    expect(backend.calls).toHaveLength(3)
    // Hiçbir çağrıda birden fazla kararın metni aynı bağlamda değil.
    for (const call of backend.calls) expect(call).toHaveLength(1)
  })

  it('varsayılan K değeri DEFAULT_RELATE_LIMIT ile eşleşir', async () => {
    const backend = recordingBackend()
    const documents = Array.from({ length: DEFAULT_RELATE_LIMIT + 5 }, (_, i) => doc(String(i)))
    const results = await relateDocumentsToCase(documents, 'olay özeti', backend)

    expect(results).toHaveLength(DEFAULT_RELATE_LIMIT)
  })

  it('özel K sınırı ilk-K kararla sınırlar', async () => {
    const backend = recordingBackend()
    const documents = [doc('1'), doc('2'), doc('3'), doc('4'), doc('5')]
    const results = await relateDocumentsToCase(documents, 'olay özeti', backend, { limit: 2 })

    expect(results.map((r) => r.documentId)).toEqual(['1', '2'])
  })

  it('olay özeti bütçeyi aşarsa hata fırlatır, hiçbir karara geçmez', async () => {
    const backend = recordingBackend()
    const tooLong = 'x'.repeat((CASE_SUMMARY_TOKEN_BUDGET + 100) * 4)

    await expect(
      relateDocumentsToCase([doc('1'), doc('2')], tooLong, backend),
    ).rejects.toThrow(CaseSummaryTooLongError)
    expect(backend.calls).toHaveLength(0)
  })

  it('bütçe sınırındaki olay özetini kabul eder', async () => {
    const backend = recordingBackend()
    const atBudget = 'x'.repeat(CASE_SUMMARY_TOKEN_BUDGET * 4)

    await expect(
      relateDocumentsToCase([doc('1')], atBudget, backend),
    ).resolves.toHaveLength(1)
  })

  it('boş aday listesinde çökmez, boş döner', async () => {
    const backend = recordingBackend()
    const results = await relateDocumentsToCase([], 'olay özeti', backend)
    expect(results).toEqual([])
    expect(backend.calls).toHaveLength(0)
  })
})
