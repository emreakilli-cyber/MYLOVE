import { describe, expect, it } from 'vitest'
import { mask } from '../mask/mask'
import type { ResearchDocument } from './client'
import {
  type CorrelationBackend,
  correlateWithCase,
  type DocumentSummarizer,
  summarizeDocument,
} from './correlate'
import { UnmaskedContentError } from './guard'

const RAW_SUMMARY = 'Müvekkil 10000000146 TC no ile ilgili tazminat talep ediyor.'

const docs: ResearchDocument[] = [
  { id: '1', title: 'Karar 1', excerpt: 'a' },
  { id: '2', title: 'Karar 2', excerpt: 'b' },
  { id: '3', title: 'Karar 3', excerpt: 'c' },
]

describe('correlateWithCase (M7.6)', () => {
  it('maskelenmemiş olay özeti kapıdan geçemez, backend hiç çağrılmaz', async () => {
    let calls = 0
    const backend: CorrelationBackend = {
      correlate: async () => {
        calls++
        return { documentId: '1', relevant: true }
      },
    }

    await expect(correlateWithCase(RAW_SUMMARY, docs, backend)).rejects.toThrow(
      UnmaskedContentError,
    )
    expect(calls).toBe(0)
  })

  it('her karar BAĞIMSIZ değerlendirilir — backend her seferinde tek karar görür', async () => {
    const seenCounts: number[] = []
    const backend: CorrelationBackend = {
      correlate: async (_summary, document) => {
        // `document` tekil bir nesnedir, dizi değil — imza bunu zaten zorluyor.
        seenCounts.push(1)
        return { documentId: document.id, relevant: true }
      },
    }
    const masked = mask(RAW_SUMMARY).text

    const verdicts = await correlateWithCase(masked, docs, backend)

    expect(verdicts).toHaveLength(3)
    expect(verdicts.map((v) => v.documentId)).toEqual(['1', '2', '3'])
    expect(seenCounts).toHaveLength(3)
  })

  it('limit (K) uygulanır — fazla aday backend’e hiç gitmez', async () => {
    let calls = 0
    const backend: CorrelationBackend = {
      correlate: async (_summary, document) => {
        calls++
        return { documentId: document.id, relevant: false }
      },
    }
    const masked = mask(RAW_SUMMARY).text

    const verdicts = await correlateWithCase(masked, docs, backend, { limit: 2 })

    expect(calls).toBe(2)
    expect(verdicts).toHaveLength(2)
  })

  it('maskelenmiş metinde kimlik verisi kalmadıysa geçer', async () => {
    const backend: CorrelationBackend = {
      correlate: async (_summary, document) => ({ documentId: document.id, relevant: true }),
    }
    await expect(correlateWithCase('Temiz olay özeti.', docs, backend)).resolves.toHaveLength(3)
  })
})

describe('summarizeDocument (M7.6)', () => {
  it('kararı özetler, kamu metni olduğu için kapıdan geçmeye ihtiyaç duymaz', async () => {
    const summarizer: DocumentSummarizer = {
      summarize: async (document) => `özet: ${document.title}`,
    }

    const summary = await summarizeDocument(docs[0]!, summarizer)

    expect(summary).toBe('özet: Karar 1')
  })
})
