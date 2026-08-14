import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { mask } from '../mask/mask'
import { createDictionaryNerBackend } from '../mask/ner'
import { preflightCheck } from '../mask/preflight'
import { ResearchClient, type ResearchDocument, type ResearchTransport } from './client'
import { UnmaskedContentError, assertMasked, findUnmaskedContent } from './guard'
import { correlateWithCase, summarizeDocuments } from './summarize'

const RAW = 'Müvekkil 10000000146 TC no ile 0532 111 22 33 numarasından arandı.'

describe('MaskGuard (M7.2, M7.3)', () => {
  it('maskelenmemiş metni her zaman reddeder', () => {
    expect(() => assertMasked(RAW)).toThrow(UnmaskedContentError)
  })

  it('maskelenmiş metni geçirir', () => {
    const masked = mask(RAW)
    expect(() => assertMasked(masked.text)).not.toThrow()
  })

  it('bulunan tipleri bildirir ama ham değeri taşımaz', () => {
    let caught: UnmaskedContentError | undefined
    try {
      assertMasked(RAW)
    } catch (error) {
      caught = error as UnmaskedContentError
    }

    expect(caught?.findings.map((finding) => finding.type)).toEqual(['TCKN', 'TEL'])
    for (const finding of caught?.findings ?? []) {
      expect(finding.preview).not.toBe('10000000146')
      expect(finding.preview).toContain('•')
    }
    expect(caught?.message).not.toContain('10000000146')
  })

  it('NER verilirse ad da yakalanır', () => {
    const ner = createDictionaryNerBackend({ people: ['Ahmet Yılmaz'] })
    expect(findUnmaskedContent('Ahmet Yılmaz beyanda bulundu', { ner })).toHaveLength(1)
    expect(findUnmaskedContent('Ahmet Yılmaz beyanda bulundu')).toHaveLength(0)
  })
})

describe('ResearchClient (M7.1, M7.4, M7.7)', () => {
  const transport: ResearchTransport = {
    search: async () => [{ id: '1', title: 'Karar', excerpt: 'özet' }],
  }

  it('maskelenmemiş sorgu taşımaya HİÇ ulaşmaz', async () => {
    let reached = false
    const spy: ResearchTransport = {
      search: async () => {
        reached = true
        return []
      },
    }

    const client = new ResearchClient({ transport: spy })
    await expect(client.search({ text: RAW, kind: 'yargitay' })).rejects.toThrow(
      UnmaskedContentError,
    )
    expect(reached).toBe(false)
  })

  it('maskelenmiş sorgu ağdan cevap alır', async () => {
    const client = new ResearchClient({ transport })
    const response = await client.search({ text: mask(RAW).text, kind: 'yargitay' })

    expect(response.source).toBe('network')
    expect(response.documents).toHaveLength(1)
  })

  it('ağ patlarsa yerel dizinden cevap verir, hata fırlatmaz', async () => {
    const failing: ResearchTransport = {
      search: async () => {
        throw new Error('ağ yok')
      },
    }
    const client = new ResearchClient({
      transport: failing,
      localIndex: { search: () => [{ id: 'yerel', title: 'Yerel karar', excerpt: '…' }] },
    })

    const response = await client.search({ text: 'maskeli sorgu', kind: 'mevzuat' })
    expect(response.source).toBe('local')
    expect(response.note).toBe('ağ yok')
  })

  it('ne ağ ne yerel dizin varsa boş döner, çökmez', async () => {
    const response = await new ResearchClient().search({ text: 'sorgu', kind: 'mevzuat' })
    expect(response).toMatchObject({ source: 'unavailable', documents: [] })
  })
})

describe('preflight kapısı (M11)', () => {
  it('kimlik verisi bulur ve maskeli önizleme üretir', () => {
    const result = preflightCheck(RAW, { destination: 'network' })

    expect(result.clean).toBe(false)
    expect(result.entities.map((entity) => entity.type)).toEqual(['TCKN', 'TEL'])
    expect(result.maskedPreview.text).toContain('[TCKN_1]')
  })

  it('temiz metinde akışı kesmez', () => {
    expect(preflightCheck('Sözleşme feshedilmiştir.', { destination: 'network' }).clean).toBe(
      true,
    )
  })

  it('ağa giden hedefte maskesiz gönderme seçeneği YOK (M11.5)', () => {
    expect(preflightCheck(RAW, { destination: 'network' }).canSendUnmasked).toBe(false)
    expect(preflightCheck(RAW, { destination: 'local' }).canSendUnmasked).toBe(true)
  })

  it('şüpheli adayı da bildirir, sessizce geçmez', () => {
    const result = preflightCheck('Kimlik 12345678901', { destination: 'network' })
    expect(result.clean).toBe(false)
    expect(result.suspects).toHaveLength(1)
  })
})

describe('özetleme ve olayla ilişkilendirme (M7.6)', () => {
  const docs: ResearchDocument[] = [
    { id: 'k1', title: 'Karar 1', excerpt: 'kira tespiti' },
    { id: 'k2', title: 'Karar 2', excerpt: 'tahliye' },
    { id: 'k3', title: 'Karar 3', excerpt: 'alacak' },
  ]

  it('her belgeyi bağımsız özetler — her çağrı tam olarak kendi belgesini alır', async () => {
    const received: ResearchDocument[] = []
    const summaries = await summarizeDocuments(docs, {
      summarize: (document) => {
        received.push(document)
        return `özet:${document.id}`
      },
    })

    expect(summaries).toEqual([
      { documentId: 'k1', summary: 'özet:k1' },
      { documentId: 'k2', summary: 'özet:k2' },
      { documentId: 'k3', summary: 'özet:k3' },
    ])
    // Her çağrı, kendi karşılığı olan belgenin ta kendisini aldı — başka bir
    // belge referansı ya da dizi değil.
    expect(received).toEqual(docs)
  })

  it('maskelenmemiş olay özeti kapıdan geçemez (M7.2 ile aynı kapı)', async () => {
    await expect(
      correlateWithCase('TC 10000000146 ile başvurdu', docs, {
        correlate: () => ({ relevant: true, rationale: '', confidence: 1 }),
      }),
    ).rejects.toThrow(UnmaskedContentError)
  })

  it('K bağımsız geçiş eşzamanlı başlar — hiçbiri diğerinin sonucunu beklemez', async () => {
    const startedOrder: string[] = []
    const receivedDocs: ResearchDocument[] = []
    const resolvers: Array<() => void> = []
    const backend = {
      correlate: (_caseSummary: string, document: ResearchDocument) => {
        startedOrder.push(document.id)
        receivedDocs.push(document)
        return new Promise<{ relevant: boolean; rationale: string; confidence: number }>(
          (resolve) => {
            resolvers.push(() =>
              resolve({ relevant: document.id === 'k2', rationale: document.id, confidence: 0.5 }),
            )
          },
        )
      },
    }

    const pending = correlateWithCase('maskeli olay özeti: tahliye talebi', docs, backend)

    // Hiçbiri henüz çözülmeden ÖNCE üçü de başlamış olmalı — sıralı `await`
    // olsaydı burada yalnız 'k1' görünürdü.
    expect(startedOrder).toEqual(['k1', 'k2', 'k3'])
    expect(receivedDocs).toEqual(docs)

    for (const resolve of resolvers) resolve()
    const results = await pending

    expect(results).toHaveLength(3)
    expect(results.find((result) => result.documentId === 'k2')?.relevant).toBe(true)
  })

  it('limit verilirse yalnız ilk-K aday değerlendirilir', async () => {
    const seenIds: string[] = []
    const results = await correlateWithCase(
      'maskeli olay özeti',
      docs,
      {
        correlate: (_summary, document) => {
          seenIds.push(document.id)
          return { relevant: false, rationale: '', confidence: 0 }
        },
      },
      { limit: 2 },
    )

    expect(results).toHaveLength(2)
    expect(seenIds).toEqual(['k1', 'k2'])
  })
})

describe('ağ erişimi yalnız research modülünde (M7.5)', () => {
  const srcRoot = fileURLToPath(new URL('..', import.meta.url))

  function walk(directory: string): string[] {
    const files: string[] = []
    for (const name of readdirSync(directory)) {
      const path = join(directory, name)
      if (statSync(path).isDirectory()) files.push(...walk(path))
      else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) files.push(path)
    }
    return files
  }

  it('research dışındaki hiçbir dosyada ağ API çağrısı yok', () => {
    const network = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|navigator\.sendBeacon/
    const offenders = walk(srcRoot)
      .filter((file) => !file.includes(`${'research'}`))
      .filter((file) => network.test(readFileSync(file, 'utf8')))

    expect(offenders).toEqual([])
  })

  it('research modülü de ağ API’sine doğrudan dokunmaz — taşıma dışarıdan gelir', () => {
    const network = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/
    for (const file of walk(fileURLToPath(new URL('.', import.meta.url)))) {
      expect(readFileSync(file, 'utf8')).not.toMatch(network)
    }
  })
})
