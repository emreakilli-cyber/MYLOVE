import { describe, expect, it } from 'vitest'
import type { ResearchDocument } from './client'
import { correlateDocuments, type CorrelationBackend } from './correlate'

function doc(id: string, excerpt = 'içerik'): ResearchDocument {
  return { id, title: `Karar ${id}`, excerpt }
}

describe('correlateDocuments (M7.6)', () => {
  it('her adayı KENDİ geçişinde değerlendirir — diğer adayları asla görmez', async () => {
    const seenPerCall: string[][] = []
    const backend: CorrelationBackend = {
      id: 'spy',
      runsLocally: true,
      correlate(_caseSummary, document) {
        // Çağrının kendisi tek bir belge alır; bu satırın derlenmesi bile
        // "diğer adaylara erişim yok" sözleşmesinin tip düzeyinde kanıtıdır.
        seenPerCall.push([document.id])
        return { relevant: document.id === 'b' }
      },
    }

    const docs = [doc('a'), doc('b'), doc('c')]
    const results = await correlateDocuments('olay özeti', docs, backend)

    expect(seenPerCall).toEqual([['a'], ['b'], ['c']])
    expect(results).toEqual([
      { documentId: 'a', relevant: false },
      { documentId: 'b', relevant: true },
      { documentId: 'c', relevant: false },
    ])
  })

  it('yalnız ilk-K adayı değerlendirir', async () => {
    const evaluated: string[] = []
    const backend: CorrelationBackend = {
      id: 'spy',
      runsLocally: true,
      correlate(_caseSummary, document) {
        evaluated.push(document.id)
        return { relevant: true }
      },
    }

    const docs = [doc('a'), doc('b'), doc('c'), doc('d')]
    const results = await correlateDocuments('olay özeti', docs, backend, { limit: 2 })

    expect(evaluated).toEqual(['a', 'b'])
    expect(results.map((r) => r.documentId)).toEqual(['a', 'b'])
  })

  it('limit verilmezse tüm adaylar değerlendirilir', async () => {
    const backend: CorrelationBackend = {
      id: 'spy',
      runsLocally: true,
      correlate: () => ({ relevant: true }),
    }

    const results = await correlateDocuments('özet', [doc('a'), doc('b')], backend)
    expect(results).toHaveLength(2)
  })

  it('boş aday listesinde boş dizi döner, çökmez', async () => {
    const backend: CorrelationBackend = { id: 'spy', runsLocally: true, correlate: () => ({ relevant: true }) }
    expect(await correlateDocuments('özet', [], backend)).toEqual([])
  })

  it('gerekçe ve güven derecesi taşınır', async () => {
    const backend: CorrelationBackend = {
      id: 'spy',
      runsLocally: true,
      correlate: () => ({ relevant: true, reasoning: 'aynı olay türü', confidence: 0.8 }),
    }

    const [result] = await correlateDocuments('özet', [doc('a')], backend)
    expect(result).toEqual({
      documentId: 'a',
      relevant: true,
      reasoning: 'aynı olay türü',
      confidence: 0.8,
    })
  })

  it('eşzamansız (model tabanlı) arka uç da çalışır', async () => {
    const backend = {
      id: 'async-spy',
      runsLocally: true as const,
      async correlate(_caseSummary: string, document: ResearchDocument) {
        return { relevant: document.id === 'a' }
      },
    }

    const results = await correlateDocuments('özet', [doc('a'), doc('b')], backend)
    expect(results).toEqual([
      { documentId: 'a', relevant: true },
      { documentId: 'b', relevant: false },
    ])
  })
})
