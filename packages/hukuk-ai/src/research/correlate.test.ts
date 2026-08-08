import { describe, expect, it } from 'vitest'
import type { ResearchDocument } from './client'
import {
  type CaseCorrelation,
  type CorrelationBackend,
  correlateResults,
  type SummaryBackend,
  summarizeResults,
} from './correlate'

const DOCS: readonly ResearchDocument[] = [
  { id: 'a', title: 'Karar A', excerpt: '…' },
  { id: 'b', title: 'Karar B', excerpt: '…' },
  { id: 'c', title: 'Karar C', excerpt: '…' },
]

describe('summarizeResults (M7.6)', () => {
  it('her belgeyi bağımsız özetler, sırayı korur', async () => {
    const seen: string[] = []
    const backend: SummaryBackend = {
      id: 'test-summarizer',
      runsLocally: true,
      summarize: (document) => {
        seen.push(document.id)
        return `özet:${document.id}`
      },
    }

    const result = await summarizeResults(DOCS, backend)

    expect(seen).toEqual(['a', 'b', 'c'])
    expect(result).toEqual([
      { documentId: 'a', summary: 'özet:a' },
      { documentId: 'b', summary: 'özet:b' },
      { documentId: 'c', summary: 'özet:c' },
    ])
  })

  it('async backend ile de çalışır', async () => {
    const backend: SummaryBackend = {
      id: 'async-summarizer',
      runsLocally: true,
      summarize: async (document) => `özet:${document.id}`,
    }

    const result = await summarizeResults(DOCS, backend)
    expect(result.map((entry) => entry.summary)).toEqual(['özet:a', 'özet:b', 'özet:c'])
  })

  it('boş belge listesinde backend hiç çağrılmaz', async () => {
    let calls = 0
    const backend: SummaryBackend = {
      id: 'counter',
      runsLocally: true,
      summarize: () => {
        calls += 1
        return ''
      },
    }

    expect(await summarizeResults([], backend)).toEqual([])
    expect(calls).toBe(0)
  })
})

describe('correlateResults (M7.6, A6 — K bağımsız kısa geçiş)', () => {
  it('her karar için TEK belge + olay özeti görür, hiçbir zaman toplu değil', async () => {
    const calls: Array<{ caseSummary: string; documentId: string }> = []
    const backend: CorrelationBackend = {
      id: 'test-correlator',
      runsLocally: true,
      correlate: (caseSummary, document) => {
        calls.push({ caseSummary, documentId: document.id })
        return { documentId: document.id, relevance: 'orta', reason: 'benzer olay' }
      },
    }

    const results = await correlateResults('olay özeti', DOCS, backend)

    expect(calls).toHaveLength(3)
    for (const call of calls) {
      expect(call.caseSummary).toBe('olay özeti')
    }
    expect(calls.map((call) => call.documentId)).toEqual(['a', 'b', 'c'])
    expect(results.map((result) => result.documentId)).toEqual(['a', 'b', 'c'])
  })

  it('girdi sırasını korur, K çıktı üretir', async () => {
    const backend: CorrelationBackend = {
      id: 'ordering',
      runsLocally: true,
      correlate: (_caseSummary, document): CaseCorrelation => ({
        documentId: document.id,
        relevance: document.id === 'b' ? 'yüksek' : 'düşük',
        reason: document.title,
      }),
    }

    const results = await correlateResults('olay özeti', DOCS, backend)
    expect(results).toEqual([
      { documentId: 'a', relevance: 'düşük', reason: 'Karar A' },
      { documentId: 'b', relevance: 'yüksek', reason: 'Karar B' },
      { documentId: 'c', relevance: 'düşük', reason: 'Karar C' },
    ])
  })

  it('boş aday listesinde backend hiç çağrılmaz, boş sonuç döner', async () => {
    let calls = 0
    const backend: CorrelationBackend = {
      id: 'counter',
      runsLocally: true,
      correlate: () => {
        calls += 1
        return { documentId: 'x', relevance: 'düşük', reason: '' }
      },
    }

    expect(await correlateResults('olay özeti', [], backend)).toEqual([])
    expect(calls).toBe(0)
  })
})
