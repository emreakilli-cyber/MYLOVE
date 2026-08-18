import { describe, expect, it } from 'vitest'
import type { ResearchDocument } from './client'
import {
  CASE_SUMMARY_CHAR_BUDGET,
  CaseSummaryTooLongError,
  type CorrelationBackend,
  correlateDocuments,
  type SummaryBackend,
  summarizeDocument,
  summarizeDocuments,
} from './summarize'

function doc(id: string, excerpt: string): ResearchDocument {
  return { id, title: `Karar ${id}`, excerpt }
}

describe('summarizeDocument / summarizeDocuments (M7.6)', () => {
  it('tek belgeyi özetler', async () => {
    const backend: SummaryBackend = { summarize: (excerpt) => `özet: ${excerpt}` }
    const summary = await summarizeDocument(doc('1', 'metin'), backend)
    expect(summary).toBe('özet: metin')
  })

  it('senkron backend de kabul edilir (Promise sarmalamaya gerek yok)', async () => {
    const backend: SummaryBackend = { summarize: (excerpt) => excerpt.toUpperCase() }
    expect(await summarizeDocument(doc('1', 'abc'), backend)).toBe('ABC')
  })

  it('her belge BAĞIMSIZ özetlenir — biri diğerinin metnini görmez', async () => {
    const seen: string[] = []
    const backend: SummaryBackend = {
      summarize: (excerpt) => {
        seen.push(excerpt)
        return excerpt
      },
    }
    const documents = [doc('1', 'birinci'), doc('2', 'ikinci'), doc('3', 'üçüncü')]
    const results = await summarizeDocuments(documents, backend)

    expect(seen).toEqual(['birinci', 'ikinci', 'üçüncü'])
    expect(results.map((r) => r.summary)).toEqual(['birinci', 'ikinci', 'üçüncü'])
    expect(results.map((r) => r.document.id)).toEqual(['1', '2', '3'])
  })
})

describe('correlateDocuments (M7.6) — K bağımsız kısa geçiş', () => {
  it('her aday KENDİ geçişinde değerlendirilir, diğer adayların metnini görmez', async () => {
    const calls: Array<{ caseSummary: string; documentExcerpt: string }> = []
    const backend: CorrelationBackend = {
      correlate: (caseSummary, documentExcerpt) => {
        calls.push({ caseSummary, documentExcerpt })
        // Diğer adayların metni bu çağrının GİRDİSİNDE hiç görünmemeli.
        return { relevant: documentExcerpt.includes('kira'), rationale: 'test' }
      },
    }

    const documents = [
      doc('1', 'kira sözleşmesi feshi'),
      doc('2', 'trafik kazası tazminatı'),
      doc('3', 'kira artışı uyuşmazlığı'),
    ]

    const results = await correlateDocuments('müvekkil kiracı, tahliye talep ediyor', documents, backend)

    expect(calls).toHaveLength(3)
    for (const [index, call] of calls.entries()) {
      // Her çağrının bağlamı yalnız kendi belgesini içerir — diğer iki
      // belgenin metni hiçbir çağrıda karışmaz.
      const others = documents.filter((_, i) => i !== index)
      for (const other of others) {
        expect(call.documentExcerpt).not.toContain(other.excerpt)
      }
    }

    expect(results.map((r) => r.score.relevant)).toEqual([true, false, true])
    expect(results.map((r) => r.document.id)).toEqual(['1', '2', '3'])
  })

  it('olay özeti bağlam bütçesini aşarsa hiçbir geçiş başlamadan hata verir', async () => {
    let called = false
    const backend: CorrelationBackend = {
      correlate: () => {
        called = true
        return { relevant: true, rationale: '' }
      },
    }
    const tooLong = 'a'.repeat(CASE_SUMMARY_CHAR_BUDGET + 1)

    await expect(correlateDocuments(tooLong, [doc('1', 'x')], backend)).rejects.toThrow(
      CaseSummaryTooLongError,
    )
    expect(called).toBe(false)
  })

  it('bütçe sınırındaki özet kabul edilir', async () => {
    const backend: CorrelationBackend = { correlate: () => ({ relevant: true, rationale: '' }) }
    const atBudget = 'a'.repeat(CASE_SUMMARY_CHAR_BUDGET)
    await expect(correlateDocuments(atBudget, [doc('1', 'x')], backend)).resolves.toHaveLength(1)
  })

  it('belge listesi boşsa boş sonuç döner, backend hiç çağrılmaz', async () => {
    let calls = 0
    const backend: CorrelationBackend = {
      correlate: () => {
        calls += 1
        return { relevant: false, rationale: '' }
      },
    }
    const results = await correlateDocuments('kısa özet', [], backend)
    expect(results).toEqual([])
    expect(calls).toBe(0)
  })
})
