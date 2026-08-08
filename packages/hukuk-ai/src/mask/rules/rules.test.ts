import { describe, expect, it } from 'vitest'
import { detectCaseNumber } from './caseNo'
import { detectDate } from './date'
import { detectEmail } from './email'
import { detectIban, isValidIban } from './iban'
import { detectPhone, normalizePhone } from './phone'
import { detectPlate } from './plate'
import { detectTckn, isValidTckn } from './tckn'

/*
 * Kural katmanının sözleşmesi: doğrulaması olan tipler doğrulamadan geçmeden
 * maskelenmez. Bu yüzden her tip için pozitif VE negatif örnek aranıyor —
 * yalnız pozitif test, "her 11 haneyi maskele" gibi bir uygulamayı da geçirir.
 */

describe('TCKN (M2.1)', () => {
  it('resmî algoritmadan geçen numarayı tanır', () => {
    expect(isValidTckn('10000000146')).toBe(true)
    expect(isValidTckn('11111111110')).toBe(true)
  })

  it('kontrol hanesi tutmayan numarayı reddeder', () => {
    expect(isValidTckn('12345678901')).toBe(false)
    expect(isValidTckn('10000000145')).toBe(false)
  })

  it('sıfırla başlayan ve yanlış uzunluktaki numarayı reddeder', () => {
    expect(isValidTckn('01234567890')).toBe(false)
    expect(isValidTckn('1000000014')).toBe(false)
    expect(isValidTckn('100000001466')).toBe(false)
  })

  it('geçerli TCKN maskelenir, geçersiz olan şüpheli listesine düşer', () => {
    const valid = detectTckn('TC: 10000000146 numaralı müvekkil')
    expect(valid.spans).toHaveLength(1)
    expect(valid.spans[0]?.type).toBe('TCKN')
    expect(valid.suspects).toHaveLength(0)

    const invalid = detectTckn('Dosya sayısı 12345678901 olarak geçiyor')
    expect(invalid.spans).toHaveLength(0)
    expect(invalid.suspects).toHaveLength(1)
  })

  it('daha uzun bir rakam dizisinin içinden kesit almaz', () => {
    const result = detectTckn('Referans 1000000014612345 kaydı')
    expect(result.spans).toHaveLength(0)
    expect(result.suspects).toHaveLength(0)
  })
})

describe('IBAN (M2.2)', () => {
  it('mod-97 geçen IBAN’ı boşluklu ve boşluksuz tanır', () => {
    expect(isValidIban('TR330006100519786457841326')).toBe(true)
    expect(isValidIban('TR33 0006 1005 1978 6457 8413 26')).toBe(true)
  })

  it('checksum tutmayan IBAN’ı reddeder', () => {
    expect(isValidIban('TR340006100519786457841326')).toBe(false)
  })

  it('boşluklu yazımı tek aralık olarak maskeler', () => {
    const result = detectIban('Hesap: TR33 0006 1005 1978 6457 8413 26 numaralı')
    expect(result.spans).toHaveLength(1)
    expect(result.spans[0]?.text).toBe('TR33 0006 1005 1978 6457 8413 26')
    expect(result.spans[0]?.key).toBe('TR330006100519786457841326')
  })

  it('hane eksik IBAN’ı maskelemez ama şüpheli sayar', () => {
    const result = detectIban('Hesap TR33 0006 1005 1978 6457 8413 2 şeklinde')
    expect(result.spans).toHaveLength(0)
    expect(result.suspects).toHaveLength(1)
    expect(result.suspects[0]?.reason).toContain('26 karakter')
  })
})

describe('Telefon (M2.3)', () => {
  it('yaygın yazımları normalleştirir', () => {
    expect(normalizePhone('+90 532 111 22 33')).toBe('5321112233')
    expect(normalizePhone('0532 111 22 33')).toBe('5321112233')
    expect(normalizePhone('05321112233')).toBe('5321112233')
    expect(normalizePhone('532 111 22 33')).toBe('5321112233')
    expect(normalizePhone('0(212) 444 55 66')).toBe('2124445566')
  })

  it('geçersiz alan kodu ve uzunluğu reddeder', () => {
    expect(normalizePhone('0932 111 22 33')).toBeUndefined()
    expect(normalizePhone('0532 111 22 3')).toBeUndefined()
  })

  it('metin içinden telefonu çıkarır', () => {
    const result = detectPhone('Müvekkile 0532 111 22 33 numarasından ulaşıldı.')
    expect(result.spans).toHaveLength(1)
    expect(result.spans[0]?.key).toBe('5321112233')
  })

  it('IBAN gövdesinden telefon uydurmaz', () => {
    const result = detectPhone('TR33 0006 1005 1978 6457 8413 26')
    expect(result.spans).toHaveLength(0)
  })
})

describe('Plaka (M2.4)', () => {
  it('geçerli plaka biçimlerini tanır', () => {
    expect(detectPlate('34 ABC 123 plakalı araç').spans).toHaveLength(1)
    expect(detectPlate('06AB1234 plakalı araç').spans).toHaveLength(1)
    expect(detectPlate('81 A 1234 plakalı araç').spans).toHaveLength(1)
  })

  it('geçersiz il kodunu ve harf/rakam sayısını reddeder', () => {
    expect(detectPlate('99 ABC 123').spans).toHaveLength(0)
    expect(detectPlate('34 ABC 12345').spans).toHaveLength(0)
  })

  it('küçük harfli ifadeyi plaka saymaz', () => {
    expect(detectPlate('34 ada 123 parselde').spans).toHaveLength(0)
  })
})

describe('Tarih (M2.5)', () => {
  it('sayısal, ISO ve yazılı biçimleri aynı anahtara indirger', () => {
    const numeric = detectDate('12.03.2024 tarihinde')
    const iso = detectDate('2024-03-12 tarihinde')
    const textual = detectDate('12 Mart 2024 tarihinde')

    expect(numeric.spans[0]?.key).toBe('2024-03-12')
    expect(iso.spans[0]?.key).toBe('2024-03-12')
    expect(textual.spans[0]?.key).toBe('2024-03-12')
  })

  it('takvimde olmayan günü reddeder', () => {
    expect(detectDate('31.02.2024 tarihinde').spans).toHaveLength(0)
    expect(detectDate('32.01.2024 tarihinde').spans).toHaveLength(0)
  })
})

describe('Esas / karar no (M2.6)', () => {
  it('ek varsa maskeler ve eki aralığa katar', () => {
    const result = detectCaseNumber('Dava 2024/1234 E. sayılı dosyada')
    expect(result.spans).toHaveLength(1)
    expect(result.spans[0]?.text).toBe('2024/1234 E.')
  })

  it('önünde anahtar sözcük varsa maskeler', () => {
    const result = detectCaseNumber('Esas No: 2024/1234 sayılı dosya')
    expect(result.spans).toHaveLength(1)
    expect(result.spans[0]?.key).toBe('2024/1234')
  })

  it('bağlamsız kesirli sayıyı maskelemez', () => {
    expect(detectCaseNumber('Oran 2024/1234 olarak hesaplandı').spans).toHaveLength(0)
  })
})

describe('E-posta (M2.7)', () => {
  it('adresi bulur ve anahtarı küçültür', () => {
    const result = detectEmail('İletişim: Av.Ahmet@Ornek.COM adresinden')
    expect(result.spans).toHaveLength(1)
    expect(result.spans[0]?.key).toBe('av.ahmet@ornek.com')
  })

  it('@ içermeyen dizgeyi almaz', () => {
    expect(detectEmail('ornek.com adresinde').spans).toHaveLength(0)
  })
})
