import { describe, expect, it } from 'vitest'
import {
  pinDogrula,
  pinOzetiUret,
  sifrele,
  sifreCoz,
  SifreCozmeHatasi,
} from './kripto'

/*
 * Güvenlik katmanı: PIN özeti ve şifreli yedek. WebCrypto vitest'te Node'un
 * globalThis.crypto'su üzerinden çalışır.
 */

describe('PIN özeti', () => {
  it('doğru PIN eşleşir, yanlış eşleşmez', async () => {
    const ozet = await pinOzetiUret('2468')
    expect(await pinDogrula('2468', ozet)).toBe(true)
    expect(await pinDogrula('1357', ozet)).toBe(false)
  })

  it('ham PIN özet içinde geçmez', async () => {
    const ozet = await pinOzetiUret('9911')
    expect(ozet.includes('9911')).toBe(false)
    expect(ozet.startsWith('pbkdf2$')).toBe(true)
  })

  it('aynı PIN her seferinde farklı özet üretir (tuz)', async () => {
    const a = await pinOzetiUret('0000')
    const b = await pinOzetiUret('0000')
    expect(a).not.toBe(b)
    // Yine de ikisi de doğrulanır.
    expect(await pinDogrula('0000', a)).toBe(true)
    expect(await pinDogrula('0000', b)).toBe(true)
  })

  it('bozuk özet güvenli biçimde reddedilir', async () => {
    expect(await pinDogrula('1234', 'geçersiz')).toBe(false)
  })
})

describe('şifreli yedek', () => {
  it('şifreleyip doğru parolayla çözer', async () => {
    const metin = JSON.stringify({ dosya: 'Yılmaz / Arslan', tutar: 184500 })
    const zarf = await sifrele(metin, 'gizli-parola')
    expect(zarf.bicim).toBe('juriscalendar-sifreli-yedek')
    const cozulmus = await sifreCoz(zarf, 'gizli-parola')
    expect(cozulmus).toBe(metin)
  })

  it('şifreli veri düz metni içermez', async () => {
    const zarf = await sifrele('MÜVEKKİL SIRRI', 'parola')
    expect(zarf.veri.includes('SIRRI')).toBe(false)
  })

  it('yanlış parola SifreCozmeHatasi fırlatır', async () => {
    const zarf = await sifrele('veri', 'doğru')
    await expect(sifreCoz(zarf, 'yanlış')).rejects.toBeInstanceOf(
      SifreCozmeHatasi,
    )
  })

  it('Türkçe karakterleri korur', async () => {
    const metin = 'İstinaf süresi — ğüşöçı ĞÜŞÖÇİ'
    const zarf = await sifrele(metin, 'p')
    expect(await sifreCoz(zarf, 'p')).toBe(metin)
  })
})
