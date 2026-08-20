import { describe, expect, it } from 'vitest'
import { aciliyetAksani, olayGorunumleri, olayTurleri } from './olay'

/*
 * Olay türü yapılandırması eksiksiz ve tutarlı olmalı. `olayGorunumleri` bir
 * `Record<OlayTuru>` olduğundan TS derlemede eksik türü yakalar; ama
 * `olayTurleri` düz bir dizidir — yeni bir tür eklenip buraya EKLENMEZSE tür
 * `olayGorunumleri`de zorunlu olur ama olay formunun tür seçicisinde GÖRÜNMEZ.
 * Bu test o sessiz kaymayı yakalar.
 */
describe('olay yapılandırması', () => {
  it('olayTurleri tam olarak tüm olay türlerini kapsar (form seçicisi eksiksiz)', () => {
    // olayGorunumleri Record<OlayTuru> olduğundan anahtarları TAM türü verir.
    expect([...olayTurleri].sort()).toEqual(Object.keys(olayGorunumleri).sort())
  })

  it('olayTurleri tekrarsızdır', () => {
    expect(new Set(olayTurleri).size).toBe(olayTurleri.length)
  })

  it('her görünüm geçerli bir accent ve boş olmayan etiket taşır', () => {
    const gecerliAccent = new Set(['red', 'amber', 'purple', 'blue', 'green', 'slate'])
    for (const g of Object.values(olayGorunumleri)) {
      expect(gecerliAccent.has(g.accent)).toBe(true)
      expect(g.etiket.length).toBeGreaterThan(0)
    }
  })

  it('aciliyetAksani dört aciliyet seviyesini de kapsar', () => {
    expect(Object.keys(aciliyetAksani).sort()).toEqual([
      'gecti',
      'kritik',
      'normal',
      'yakin',
    ])
  })
})
