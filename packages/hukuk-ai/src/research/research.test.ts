import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { mask } from '../mask/mask'
import { createDictionaryNerBackend } from '../mask/ner'
import { preflightCheck } from '../mask/preflight'
import { ResearchClient, type ResearchTransport } from './client'
import { UnmaskedContentError, assertMasked, findUnmaskedContent } from './guard'

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
