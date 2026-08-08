import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { mask, maskAsync, unmask } from '../mask'
import { createDictionaryNerBackend } from './dictionary'
import { freeRegions } from './index'
import type { AsyncNerBackend } from './types'

const backend = createDictionaryNerBackend({
  people: ['Ahmet Yılmaz', 'Mehmet Yılmaz'],
  organizations: ['Demir İnşaat'],
  workplaces: ['Egeperla AVM'],
})

describe('boşluk hesabı (M3.7)', () => {
  it('kural aralıklarının dışını doğru çıkarır', () => {
    expect(freeRegions(20, [{ start: 5, end: 10 }])).toEqual([
      { start: 0, end: 5 },
      { start: 10, end: 20 },
    ])
  })

  it('bitişik ve iç içe aralıkları birleştirir', () => {
    expect(
      freeRegions(
        20,
        [
          { start: 0, end: 5 },
          { start: 3, end: 8 },
        ],
      ),
    ).toEqual([{ start: 8, end: 20 }])
  })
})

describe('sözlük tabanlı NER (M3.3)', () => {
  it('bilinen adı yakalar', () => {
    const masked = mask('Müvekkil Ahmet Yılmaz beyanda bulundu.', { ner: backend })
    expect(masked.text).toBe('Müvekkil [KISI_1] beyanda bulundu.')
  })

  it('unvan ipucundan bilinmeyen adı yakalar', () => {
    const masked = mask('Karşı vekil Av. Selim Korkmaz dosyaya girdi.', { ner: backend })
    expect(masked.text).toBe('Karşı vekil Av. [KISI_1] dosyaya girdi.')
  })

  it('şirket ve işyeri ipuçlarını ayırır', () => {
    const masked = mask('Beyaz Yapı Ltd. Şti. ile Egeperla AVM arasında', { ner: backend })
    const types = masked.spans.map((span) => span.type)
    expect(types).toEqual(['KURUM', 'ISYERI'])
  })

  it('adres ipuçlarını tek aralıkta toplar', () => {
    const masked = mask('Tebligat Alsancak Mah. 1470 Sok. No:3 adresine yapıldı.', {
      ner: backend,
    })
    expect(masked.text).toBe('Tebligat [ADRES_1] adresine yapıldı.')
  })

  it('model yoksa da maskeleme çalışır, sadece desenli tipleri yakalar', () => {
    const masked = mask('Ahmet Yılmaz, TC 10000000146')
    expect(masked.text).toBe('Ahmet Yılmaz, TC [TCKN_1]')
  })
})

describe('çekim eki (M4)', () => {
  it('kesme işaretli tüm biçimler aynı maskeye düşer, ek metinde kalır', () => {
    const input = "Ahmet Yılmaz, Ahmet Yılmaz'ın, Ahmet Yılmaz'a, Ahmet Yılmaz'tan"
    const masked = mask(input, { ner: backend })

    expect(masked.table.size).toBe(1)
    expect(masked.text).toBe("[KISI_1], [KISI_1]'ın, [KISI_1]'a, [KISI_1]'tan")
    expect(unmask(masked.text, masked.table).text).toBe(input)
  })

  it('ünsüz yumuşaması olan yazımı aynı maskeye bağlar', () => {
    const masked = mask("Ahmed Yılmaz'ın beyanı", {
      ner: createDictionaryNerBackend({ people: ['Ahmet Yılmaz'] }),
    })
    expect(masked.text).toBe("[KISI_1]'ın beyanı")
  })

  it('kurum adında ek de metinde kalır (M4.5)', () => {
    const input = "Egeperla AVM'nin otoparkında"
    const masked = mask(input, { ner: backend })

    expect(masked.text).toBe("[ISYERI_1]'nin otoparkında")
    expect(unmask(masked.text, masked.table).text).toBe(input)
  })
})

describe('aynı soyisimli iki kişi (M12.3)', () => {
  it('ayrı token alır', () => {
    const masked = mask('Ahmet Yılmaz ile Mehmet Yılmaz kardeştir.', { ner: backend })

    expect(masked.text).toBe('[KISI_1] ile [KISI_2] kardeştir.')
    expect(masked.table.size).toBe(2)
  })
})

describe('iç içe geçmiş varlık (M12.6)', () => {
  it('kesişmeyen varlıkları ayrı ayrı maskeler', () => {
    const input = 'Egeperla AVM sahibi Ahmet Yılmaz'
    const masked = mask(input, { ner: backend })

    expect(masked.text).toBe('[ISYERI_1] sahibi [KISI_1]')
    expect(unmask(masked.text, masked.table).text).toBe(input)
  })
})

describe('katman sırası (SPEC S5)', () => {
  it('NER, doğrulanmış bir kural aralığını yeniden etiketleyemez', () => {
    const greedy = {
      id: 'test-greedy',
      runsLocally: true as const,
      detect: (text: string) => [
        { start: 0, end: text.length, type: 'KISI' as const, confidence: 1 },
      ],
    }

    const masked = mask('TC 10000000146', { ner: greedy })
    // Kural aralığı dışına boşluk kalmadığı için NER hiçbir şey döndüremez.
    expect(masked.spans.map((span) => span.type)).toEqual(['TCKN'])
  })
})

describe('eşzamansız model arayüzü (M3.2)', () => {
  it('async backend ile aynı sonucu verir', async () => {
    const asyncBackend: AsyncNerBackend = {
      id: 'test-async',
      runsLocally: true,
      detect: async (text, regions) =>
        Promise.resolve(backend.detect(text, regions)),
    }

    const masked = await maskAsync('Müvekkil Ahmet Yılmaz', { ner: asyncBackend })
    expect(masked.text).toBe('Müvekkil [KISI_1]')
  })
})

describe('NER katmanında ağ yasağı (M3.6)', () => {
  it('ner klasöründe hiçbir ağ çağrısı geçmiyor', () => {
    const files = ['dictionary.ts', 'index.ts', 'types.ts']
    const forbidden = /\b(fetch|XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon|import\s*\()/

    for (const name of files) {
      const path = fileURLToPath(new URL(name, import.meta.url))
      expect(readFileSync(path, 'utf8')).not.toMatch(forbidden)
    }
  })
})

describe('belirsiz soyisim (M5.3, SPEC §7/7)', () => {
  const iki = createDictionaryNerBackend({ people: ['Ahmet Yılmaz', 'Mehmet Yılmaz'] })

  it('çıplak soyisim iki kişiye uyuyorsa BELİRSİZ işaretlenir, tahmin edilmez', () => {
    const masked = mask('Ahmet Yılmaz ve Mehmet Yılmaz geldi. Yılmaz beyan verdi.', {
      ner: iki,
    })

    // Tam adlar ayrı ayrı; çıplak soyisim üçüncü, ayrı bir maske.
    expect(masked.text).toBe('[KISI_1] ve [KISI_2] geldi. [KISI_3] beyan verdi.')

    const belirsiz = masked.table.lookup('[KISI_3]')
    expect(belirsiz?.ambiguous).toBe(true)
    expect(belirsiz?.candidates).toEqual(['AHMET YILMAZ', 'MEHMET YILMAZ'])
  })

  it('tam adlar belirsiz işaretlenmez', () => {
    const masked = mask('Ahmet Yılmaz ve Mehmet Yılmaz', { ner: iki })
    expect(masked.table.lookup('[KISI_1]')?.ambiguous).toBe(false)
    expect(masked.table.lookup('[KISI_2]')?.ambiguous).toBe(false)
  })

  it('soyismi taşıyan tek kişi varsa o kişiye bağlanır, belirsizlik yok', () => {
    const tek = createDictionaryNerBackend({ people: ['Ahmet Yılmaz'] })
    const masked = mask('Ahmet Yılmaz geldi. Yılmaz beyan verdi.', { ner: tek })

    expect(masked.text).toBe('[KISI_1] geldi. [KISI_1] beyan verdi.')
    expect(masked.table.lookup('[KISI_1]')?.ambiguous).toBe(false)
  })

  it('tam ad içindeki soyisim ayrıca maskelenmez', () => {
    const masked = mask('Ahmet Yılmaz', { ner: iki })
    expect(masked.spans).toHaveLength(1)
    expect(masked.spans[0]?.text).toBe('Ahmet Yılmaz')
  })

  it('belirsiz maske de birebir geri döner', () => {
    const input = 'Ahmet Yılmaz ve Mehmet Yılmaz geldi. Yılmaz beyan verdi.'
    const masked = mask(input, { ner: iki })
    expect(unmask(masked.text, masked.table).text).toBe(input)
  })
})

describe('aynı dizge iki farklı tip (M12.7)', () => {
  it('kişi ve kurum aynı dizgeye uyarsa öncelik tablosu karar verir', () => {
    const ikili = createDictionaryNerBackend({
      people: ['Yılmaz Demir'],
      organizations: ['Yılmaz Demir'],
    })
    const masked = mask('Yılmaz Demir taraf olarak gösterildi.', { ner: ikili })

    // SPEC §6.1: uzunluk eşit → öncelik KISI (80) < KURUM (90).
    expect(masked.spans).toHaveLength(1)
    expect(masked.spans[0]?.type).toBe('KISI')
    expect(masked.text).toBe('[KISI_1] taraf olarak gösterildi.')
  })

  it('uzun olan kısa olanı yener: kurum adı kişi adını içeriyorsa kurum kazanır', () => {
    const ikili = createDictionaryNerBackend({
      people: ['Ahmet Yılmaz'],
      organizations: ['Ahmet Yılmaz İnşaat'],
    })
    const masked = mask('Ahmet Yılmaz İnşaat sözleşmeyi imzaladı.', { ner: ikili })

    expect(masked.spans).toHaveLength(1)
    expect(masked.spans[0]?.type).toBe('KURUM')
    expect(masked.text).toBe('[KURUM_1] sözleşmeyi imzaladı.')
  })
})
