import { describe, expect, it } from 'vitest'
import type { ResearchDocument } from './client'
import {
  correlateWithEvent,
  DEFAULT_CORRELATION_LIMIT,
  DocumentTooLongForSummaryError,
  EventSummaryTooLongError,
  MAX_DOCUMENT_TOKENS_FOR_SUMMARY,
  MAX_EVENT_SUMMARY_TOKENS,
  summarizeDocument,
  summarizeDocuments,
  type CorrelationBackend,
  type CorrelationVerdict,
  type SummaryBackend,
} from './correlate'

function document(id: string, excerpt = 'karar özeti'): ResearchDocument {
  return { id, title: `Karar ${id}`, excerpt }
}

describe('summarizeDocument / summarizeDocuments (M7.6)', () => {
  const backend: SummaryBackend = {
    id: 'test-summarizer',
    runsLocally: true,
    summarize: (doc) => `özet: ${doc.title}`,
  }

  it('tek belgeyi özetler', async () => {
    const result = await summarizeDocument(document('1'), backend)
    expect(result).toEqual({ documentId: '1', summary: 'özet: Karar 1' })
  })

  it('bütçeyi aşan belgeyi özetlemeden ÖNCE reddeder', async () => {
    const huge = document('2', 'x'.repeat((MAX_DOCUMENT_TOKENS_FOR_SUMMARY + 1) * 4))
    await expect(summarizeDocument(huge, backend)).rejects.toThrow(DocumentTooLongForSummaryError)
  })

  it('sınırdaki belgeyi kabul eder (sınır kapsayıcıdır)', async () => {
    const atLimit = document('3', 'x'.repeat(MAX_DOCUMENT_TOKENS_FOR_SUMMARY * 4))
    await expect(summarizeDocument(atLimit, backend)).resolves.toMatchObject({ documentId: '3' })
  })

  it('birden çok belgeyi bağımsız özetler, her çağrı yalnız kendi belgesini görür', async () => {
    const seen: string[] = []
    const spy: SummaryBackend = {
      id: 'spy',
      runsLocally: true,
      summarize: (doc) => {
        seen.push(doc.id)
        return `özet-${doc.id}`
      },
    }

    const results = await summarizeDocuments([document('a'), document('b'), document('c')], spy)

    expect(results.map((r) => r.documentId)).toEqual(['a', 'b', 'c'])
    expect(seen.sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('correlateWithEvent (M7.6)', () => {
  const alwaysRelevant: CorrelationBackend = {
    id: 'test-correlator',
    runsLocally: true,
    evaluate: (_summary, doc) => ({
      documentId: doc.id,
      relevant: true,
      rationale: `${doc.id} ilgili`,
    }),
  }

  it('her adayı olay özetiyle değerlendirir', async () => {
    const docs = [document('1'), document('2')]
    const result = await correlateWithEvent('müvekkil kira sözleşmesini feshetti', docs, alwaysRelevant)

    expect(result.verdicts).toHaveLength(2)
    expect(result.evaluatedCount).toBe(2)
    expect(result.skippedCount).toBe(0)
  })

  it('olay özeti bütçeyi aşarsa reddeder, hiçbir aday değerlendirilmez', async () => {
    let called = false
    const spy: CorrelationBackend = {
      id: 'spy',
      runsLocally: true,
      evaluate: () => {
        called = true
        return { documentId: 'x', relevant: true, rationale: '' }
      },
    }

    const tooLong = 'x'.repeat((MAX_EVENT_SUMMARY_TOKENS + 1) * 4)
    await expect(correlateWithEvent(tooLong, [document('1')], spy)).rejects.toThrow(
      EventSummaryTooLongError,
    )
    expect(called).toBe(false)
  })

  it('ilk-K sınırını uygular, kalanı sessizce yutmaz — sayar', async () => {
    const docs = Array.from({ length: DEFAULT_CORRELATION_LIMIT + 5 }, (_, i) => document(String(i)))
    const result = await correlateWithEvent('kısa olay özeti', docs, alwaysRelevant)

    expect(result.evaluatedCount).toBe(DEFAULT_CORRELATION_LIMIT)
    expect(result.skippedCount).toBe(5)
  })

  it('özel limit verilirse onu kullanır', async () => {
    const docs = [document('1'), document('2'), document('3')]
    const result = await correlateWithEvent('olay özeti', docs, alwaysRelevant, { limit: 1 })

    expect(result.evaluatedCount).toBe(1)
    expect(result.skippedCount).toBe(2)
    expect(result.verdicts[0]?.documentId).toBe('1')
  })

  it('K BAĞIMSIZ geçiş: her çağrı yalnız KENDİ belgesini görür, diğer adayları veya önceki sonuçları asla almaz', async () => {
    const calls: Array<{ summary: string; documentId: string; argCount: number }> = []
    const spy: CorrelationBackend = {
      id: 'spy',
      runsLocally: true,
      evaluate: (...args: unknown[]) => {
        const [summary, doc] = args as [string, ResearchDocument]
        calls.push({ summary, documentId: doc.id, argCount: args.length })
        return { documentId: doc.id, relevant: true, rationale: '' }
      },
    }

    const docs = [document('1'), document('2'), document('3')]
    await correlateWithEvent('olay özeti', docs, spy)

    expect(calls).toHaveLength(3)
    for (const call of calls) {
      // Yalnız (olay özeti, tek belge) — üçüncü bir argüman (diğer adaylar,
      // önceki sonuçlar) yok. Fonksiyon imzası bunu zaten engelliyor; burada
      // çağrı zamanında da doğrulanıyor.
      expect(call.argCount).toBe(2)
      expect(call.summary).toBe('olay özeti')
    }
    expect(calls.map((c) => c.documentId).sort()).toEqual(['1', '2', '3'])
  })

  it('bulguları taşır: alakasız kararlar da rationale ile bildirilir', async () => {
    const mixed: CorrelationBackend = {
      id: 'mixed',
      runsLocally: true,
      evaluate: (_summary, doc): CorrelationVerdict => ({
        documentId: doc.id,
        relevant: doc.id === '1',
        rationale: doc.id === '1' ? 'olayla örtüşüyor' : 'konu farklı',
      }),
    }

    const result = await correlateWithEvent('olay özeti', [document('1'), document('2')], mixed)
    expect(result.verdicts).toEqual([
      { documentId: '1', relevant: true, rationale: 'olayla örtüşüyor' },
      { documentId: '2', relevant: false, rationale: 'konu farklı' },
    ])
  })
})
