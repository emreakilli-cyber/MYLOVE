import { describe, expect, it } from 'vitest'
import { mask, unmask } from './mask'
import {
  MaskTable,
  MaskTableDecryptError,
  MaskTableSerializationError,
} from './table'

/*
 * Bu dosyanın tek asıl iddiası SPEC S1'dir: unmask(mask(x)) === x, istisnasız.
 * Diğer testler bu iddiayı kırmaya çalışan kenar durumlardır (plan M12).
 */

function roundTrip(input: string): string {
  const masked = mask(input)
  return unmask(masked.text, masked.table).text
}

describe('mask/unmask birebirliği (S1, M12.1)', () => {
  it('kimlik verisi içeren metni birebir geri getirir', () => {
    const input = [
      'Müvekkil TC 10000000146, telefon 0532 111 22 33,',
      'hesap TR33 0006 1005 1978 6457 8413 26,',
      'e-posta av.ahmet@ornek.com, plaka 34 ABC 123.',
      'Dava 2024/1234 E. sayılı dosyada 12.03.2024 tarihinde görüldü.',
    ].join('\n')

    expect(roundTrip(input)).toBe(input)
  })

  it('kişisel veri içermeyen metne dokunmaz (M12.4)', () => {
    const input = 'Sözleşmenin feshi ihbar süresine bağlıdır; taraflar mutabıktır.'
    const masked = mask(input)

    expect(masked.text).toBe(input)
    expect(masked.table.size).toBe(0)
    expect(masked.spans).toHaveLength(0)
    expect(roundTrip(input)).toBe(input)
  })

  it('aynı varlığın farklı yazımlarını tek token’a bağlar ama birebir geri getirir', () => {
    const input = '12.03.2024 ile 12 Mart 2024 aynı gündür.'
    const masked = mask(input)

    // İki geçiş de aynı token — SPEC §4.1 aynı anahtar, aynı token.
    expect(masked.table.size).toBe(1)
    expect(masked.text).toBe('[TARIH_1] ile [TARIH_1] aynı gündür.')
    // …ama geri dönüşte her geçiş kendi ham yazımına döner.
    expect(roundTrip(input)).toBe(input)
  })

  it('aynı varlık tekrar geçtiğinde yeni numara almaz', () => {
    const masked = mask('0532 111 22 33 numarası, yine 0532 111 22 33 numarası.')
    expect(masked.table.size).toBe(1)
    expect(masked.text).toBe('[TEL_1] numarası, yine [TEL_1] numarası.')
  })

  it('farklı varlıklar sırayla numaralanır', () => {
    const masked = mask('0532 111 22 33 ve 0533 222 33 44')
    expect(masked.text).toBe('[TEL_1] ve [TEL_2]')
  })
})

describe('token kaçışlama (SPEC §3.2, M12.8)', () => {
  it('kullanıcı metnindeki token benzeri dizge unmask’i bozmaz', () => {
    const input = 'Raporda [KISI_1] ifadesi geçiyordu.'
    const masked = mask(input)

    expect(masked.text).toBe('Raporda [!KISI_1] ifadesi geçiyordu.')
    expect(roundTrip(input)).toBe(input)
  })

  it('gerçek maske ile kaçışlanmış dizge yan yana durabilir', () => {
    const input = 'Not: [TEL_1] yazılmıştı, gerçek numara 0532 111 22 33.'
    const masked = mask(input)

    expect(masked.text).toBe('Not: [!TEL_1] yazılmıştı, gerçek numara [TEL_1].')
    expect(roundTrip(input)).toBe(input)
  })

  it('kat kat kaçışlanmış dizgeler de birebir döner', () => {
    const input = '[!KISI_1] ve [!!KISI_2] ve [KISI_3]'
    expect(roundTrip(input)).toBe(input)
  })
})

describe('bozuk token davranışı (SPEC §5.1, M12.5)', () => {
  it('tabloda olmayan token aynen kalır ve unresolved’a düşer', () => {
    const table = new MaskTable()
    const result = unmask('Metinde [KISI_99] geçiyor.', table)

    expect(result.text).toBe('Metinde [KISI_99] geçiyor.')
    expect(result.unresolved).toEqual(['[KISI_99]'])
  })

  it('kapanmamış veya biçimsiz token düz metin sayılır', () => {
    const table = new MaskTable()
    for (const broken of ['[KISI_', '[kisi_1]', '[KISI_0]', '[KISI_007]']) {
      const result = unmask(broken, table)
      expect(result.text).toBe(broken)
      expect(result.unresolved).toHaveLength(0)
    }
  })

  it('token kayıttan fazla tekrarlanırsa kanonik yazıma düşer, çökmez', () => {
    const masked = mask('0532 111 22 33')
    const result = unmask('[TEL_1] ve [TEL_1] ve [TEL_1]', masked.table)

    expect(result.text).toBe('0532 111 22 33 ve 0532 111 22 33 ve 0532 111 22 33')
    expect(result.unresolved).toHaveLength(0)
  })
})

describe('çakışma çözümü (SPEC §6.1, M2.8)', () => {
  it('uzun aralık kısa aralığı yener — IBAN içinden telefon çıkmaz', () => {
    const masked = mask('Hesap TR33 0006 1005 1978 6457 8413 26 numaralı')

    expect(masked.text).toBe('Hesap [IBAN_1] numaralı')
    expect(masked.spans).toHaveLength(1)
    expect(masked.spans[0]?.type).toBe('IBAN')
  })

  it('kesişmeyen varlıklar ayrı ayrı maskelenir (M12.6 çerçevesi)', () => {
    const masked = mask('34 ABC 123 plakalı araç, 0532 111 22 33 numaralı sahibi')

    const types = masked.spans.map((span) => span.type)
    expect(types).toEqual(['PLAKA', 'TEL'])
  })
})

describe('tarih maskeleme kapatılabilir (SPEC §7/8)', () => {
  it('maskDates:false verildiğinde tarihe dokunulmaz', () => {
    const input = '12.03.2024 tarihinde 0532 111 22 33 arandı.'
    const masked = mask(input, { maskDates: false })

    expect(masked.text).toBe('12.03.2024 tarihinde [TEL_1] arandı.')
    expect(unmask(masked.text, masked.table).text).toBe(input)
  })
})

describe('şüpheli adaylar sessizce yutulmaz (SPEC §7/3)', () => {
  it('doğrulamadan geçmeyen TCKN şüpheli olarak bildirilir', () => {
    const masked = mask('Kimlik 12345678901 olarak yazılmış.')

    expect(masked.text).toBe('Kimlik 12345678901 olarak yazılmış.')
    expect(masked.suspects).toHaveLength(1)
    expect(masked.suspects[0]?.type).toBe('TCKN')
  })
})

describe('determinizm (SPEC S4, M5.2)', () => {
  it('aynı girdi her zaman aynı çıktıyı verir', () => {
    const input = 'TC 10000000146, tel 0532 111 22 33, e-posta a@b.com'
    expect(mask(input).text).toBe(mask(input).text)
  })

  it('ortak tabloyla maskelenen ikinci belge numaraları sürdürür (SPEC §4.2)', () => {
    const table = new MaskTable()
    const first = mask('Telefon 0532 111 22 33', { table })
    const second = mask('Telefon 0533 222 33 44 ve 0532 111 22 33', { table })

    expect(first.text).toBe('Telefon [TEL_1]')
    expect(second.text).toBe('Telefon [TEL_2] ve [TEL_1]')
  })
})

describe('maske tablosu ağa çıkamaz (SPEC S2, M5.5)', () => {
  it('JSON.stringify sessizce çalışmaz, hata fırlatır', () => {
    const masked = mask('TC 10000000146')
    expect(() => JSON.stringify(masked.table)).toThrow(MaskTableSerializationError)
  })

  it('tablonun içeriği örtük olarak da sızmaz', () => {
    const masked = mask('TC 10000000146')
    // Özel alanlar (#) numaralandırılabilir değil; kopyalama boş nesne verir.
    expect(Object.keys({ ...masked.table })).toHaveLength(0)
  })

  it('digest yalnız özet döndürür, ham değer içermez', async () => {
    const masked = mask('TC 10000000146')
    const digest = await masked.table.digest()

    expect(digest).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(digest).not.toContain('10000000146')
  })
})

describe('rastgele metinlerde birebirlik (M12.1 özellik testi)', () => {
  /** Tohumlu doğrusal eşlenik üreteç — dış bağımlılık istemiyoruz. */
  function makeRandom(seed: number): () => number {
    let state = seed >>> 0
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0
      return state / 0x100000000
    }
  }

  const fragments = [
    'Müvekkil ',
    'TC 10000000146',
    ' telefon 0532 111 22 33',
    ' hesap TR33 0006 1005 1978 6457 8413 26',
    ' e-posta av.ahmet@ornek.com',
    ' plaka 34 ABC 123',
    ' dosya 2024/1234 E.',
    ' tarih 12.03.2024',
    ' [KISI_1]',
    ' [!TEL_2]',
    '\n',
    ' beyan ederiz ki ',
    ' 12345678901 ',
    ' ',
  ]

  it('200 rastgele bileşimde unmask(mask(x)) === x', () => {
    const random = makeRandom(20260807)

    for (let round = 0; round < 200; round += 1) {
      const pieceCount = 1 + Math.floor(random() * 12)
      let input = ''
      for (let piece = 0; piece < pieceCount; piece += 1) {
        const index = Math.floor(random() * fragments.length)
        input += fragments[index] ?? ''
      }
      expect(roundTrip(input)).toBe(input)
    }
  })
})

describe('şifreli kalıcı saklama (M5.7)', () => {
  it('dışa aktarılan blob ham veri içermez', async () => {
    const masked = mask('TC 10000000146, tel 0532 111 22 33')
    const blob = await masked.table.exportEncrypted('cok-gizli-parola')

    const serialized = JSON.stringify(blob)
    expect(serialized).not.toContain('10000000146')
    expect(serialized).not.toContain('0532')
    expect(blob.format).toBe('hukuk-ai.masktable.v1')
  })

  it('doğru parolayla geri yüklenen tablo unmask’i aynen yapar', async () => {
    const input = 'TC 10000000146, tel 0532 111 22 33'
    const masked = mask(input)
    const blob = await masked.table.exportEncrypted('cok-gizli-parola')

    const restored = await MaskTable.importEncrypted(blob, 'cok-gizli-parola')
    expect(unmask(masked.text, restored).text).toBe(input)
  })

  it('geri yüklenen tablo numaralandırmayı kaldığı yerden sürdürür', async () => {
    const first = mask('Tel 0532 111 22 33')
    const blob = await first.table.exportEncrypted('cok-gizli-parola')

    const restored = await MaskTable.importEncrypted(blob, 'cok-gizli-parola')
    const second = mask('Tel 0533 222 33 44', { table: restored })

    expect(second.text).toBe('Tel [TEL_2]')
  })

  it('yanlış parola çözemez', async () => {
    const masked = mask('TC 10000000146')
    const blob = await masked.table.exportEncrypted('cok-gizli-parola')

    await expect(MaskTable.importEncrypted(blob, 'yanlis-parola')).rejects.toThrow(
      MaskTableDecryptError,
    )
  })

  it('bozulmuş veri çözemez', async () => {
    const masked = mask('TC 10000000146')
    const blob = await masked.table.exportEncrypted('cok-gizli-parola')
    const bozuk = { ...blob, ciphertext: blob.ciphertext.slice(0, -4) + 'AAAA' }

    await expect(MaskTable.importEncrypted(bozuk, 'cok-gizli-parola')).rejects.toThrow(
      MaskTableDecryptError,
    )
  })

  it('kısa parola reddedilir', async () => {
    const masked = mask('TC 10000000146')
    await expect(masked.table.exportEncrypted('kisa')).rejects.toThrow(
      MaskTableSerializationError,
    )
  })

  it('clear() tabloyu gerçekten boşaltır', () => {
    const masked = mask('TC 10000000146, tel 0532 111 22 33')
    expect(masked.table.size).toBe(2)

    masked.table.clear()
    expect(masked.table.size).toBe(0)
    expect(masked.table.lookup('[TCKN_1]')).toBeUndefined()
  })
})
