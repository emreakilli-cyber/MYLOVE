import { describe, expect, it } from 'vitest'
import type { ResearchDocument } from './client'
import {
  createExtractiveSummaryBackend,
  summarizeDocuments,
  type SummaryBackend,
} from './summarize'

function doc(overrides: Partial<ResearchDocument> = {}): ResearchDocument {
  return { id: '1', title: 'Karar', excerpt: 'Kısa metin.', ...overrides }
}

describe('createExtractiveSummaryBackend (M7.6)', () => {
  const backend = createExtractiveSummaryBackend()

  it('modelsiz çalışır — runsLocally sabiti true', () => {
    expect(backend.runsLocally).toBe(true)
  })

  it('kısa metni değiştirmeden döner', () => {
    expect(backend.summarize(doc({ excerpt: 'Kısa metin.' }))).toBe('Kısa metin.')
  })

  it('uzun metni sınırlar ve kırpıldığını işaretler', () => {
    const long = 'Cümle bir. '.repeat(100)
    const summary = backend.summarize(doc({ excerpt: long }))
    expect(summary.length).toBeLessThan(long.length)
    expect(summary.endsWith('…')).toBe(true)
  })

  it('cümle sınırı sınırın yakınındaysa oradan keser', () => {
    const excerpt = `${'X'.repeat(300)}. ${'Y'.repeat(200)}.`
    const summary = backend.summarize(doc({ excerpt }))
    expect(summary.replace('…', '')).toMatch(/\.\s*$/)
  })
})

describe('summarizeDocuments (M7.6)', () => {
  it('her belge için ayrı sonuç üretir, girdi sırasını korur', async () => {
    const docs = [doc({ id: 'a', excerpt: 'Birinci karar.' }), doc({ id: 'b', excerpt: 'İkinci karar.' })]
    const results = await summarizeDocuments(docs)

    expect(results.map((r) => r.documentId)).toEqual(['a', 'b'])
    expect(results[0]?.summary).toBe('Birinci karar.')
    expect(results[1]?.summary).toBe('İkinci karar.')
  })

  it('bağımsız geçiş: bir belgenin özeti diğerinin içeriğini göremez', async () => {
    const seen: string[] = []
    const spy: SummaryBackend = {
      id: 'spy',
      runsLocally: true,
      summarize(document) {
        seen.push(document.id)
        return `özet:${document.id}`
      },
    }

    const docs = [doc({ id: 'x' }), doc({ id: 'y' }), doc({ id: 'z' })]
    const results = await summarizeDocuments(docs, spy)

    expect(seen).toEqual(['x', 'y', 'z'])
    expect(results.map((r) => r.summary)).toEqual(['özet:x', 'özet:y', 'özet:z'])
  })

  it('boş belge listesinde boş dizi döner, çökmez', async () => {
    expect(await summarizeDocuments([])).toEqual([])
  })
})
