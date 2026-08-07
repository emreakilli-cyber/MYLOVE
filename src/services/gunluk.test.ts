import { afterEach, describe, expect, it, vi } from 'vitest'
import { gunlukHata, gunlukle, redakteEt } from './gunluk'

/*
 * Redaksiyonlu günlük: kimlik desenleri konsola gitmeden maskelenir. Ayrıca
 * "doğrudan console.* yasak" kuralı, kaynağı tarayan bir kapıyla denetlenir
 * (proje ESLint kullanmıyor).
 */

describe('redakteEt', () => {
  it('TCKN, IBAN, e-posta ve GSM maskeler', () => {
    const ham =
      'Kişi 12345678901, IBAN TR12 0006 7010 0000 0012 3456 78, ' +
      'e-posta av@buro.av.tr, tel 0532 111 22 33'
    const temiz = redakteEt(ham)
    expect(temiz).not.toContain('12345678901')
    expect(temiz).not.toContain('TR12')
    expect(temiz).not.toContain('av@buro.av.tr')
    expect(temiz).not.toContain('0532 111 22 33')
    expect(temiz).toContain('⟦gizli⟧')
  })
})

describe('gunlukHata / gunlukle', () => {
  afterEach(() => vi.restoreAllMocks())

  it('müvekkil verili hata konsola maskeli gider (ham kimlik geçmez)', () => {
    const yakala = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const hata = new Error(
      'Kayıt hatası: TCKN 98765432109, IBAN TR33 0006 1005 1978 6457 8413 26',
    )
    gunlukHata(hata, 'Dosya kaydı')
    const cikti = yakala.mock.calls.map((c) => String(c[0])).join('\n')
    expect(cikti).not.toContain('98765432109')
    expect(cikti).not.toContain('TR33')
    expect(cikti).toContain('⟦gizli⟧')
  })

  it('ek bağlam da redaksiyondan geçer', () => {
    const yakala = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    gunlukle('bilgi', 'işlem', { eposta: 'x@y.com' })
    const cikti = String(yakala.mock.calls[0]?.[0] ?? '')
    expect(cikti).not.toContain('x@y.com')
  })
})

describe('doğrudan console.* yasak (kaynak kapısı)', () => {
  it('gunluk.ts dışında hiçbir kaynakta console. çağrısı yok', () => {
    // Vite glob ile tüm kaynakları ham metin olarak oku (node bağımlılığı yok).
    const kaynaklar = import.meta.glob('/src/**/*.{ts,tsx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>

    const ihlaller: string[] = []
    for (const [yol, icerik] of Object.entries(kaynaklar)) {
      if (yol.includes('.test.') || yol.endsWith('/gunluk.ts')) continue
      if (/\bconsole\s*\./.test(icerik)) ihlaller.push(yol)
    }
    expect(ihlaller, `Doğrudan console kullanımı: ${ihlaller.join(', ')}`).toEqual(
      [],
    )
  })
})
