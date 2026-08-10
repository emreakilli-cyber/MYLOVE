import { describe, expect, it } from 'vitest'
import { HATIRLATMA_SECENEKLERI, ofsetEtiketi } from './ayarlarIslemleri'

/*
 * Hatırlatma ofset etiketi. Katalogda karşılığı olan ofset için katalog
 * etiketi, olmayan için birimli yedek metin (dk / saat / gün) üretilir.
 * Etiket kullanıcıya "ne zaman hatırlatılacağını" söyler; yanlış birim
 * yanıltıcı olur.
 */

describe('ofsetEtiketi — katalog eşleşmesi', () => {
  it('katalogdaki ofset için katalog etiketini döndürür', () => {
    expect(ofsetEtiketi(0)).toBe('Aynı gün')
    expect(ofsetEtiketi(60)).toBe('1 saat önce')
    expect(ofsetEtiketi(7 * 24 * 60)).toBe('7 gün önce')
    expect(ofsetEtiketi(30 * 24 * 60)).toBe('30 gün önce')
  })

  it('her katalog kaydının etiketi ofsetEtiketi ile tutarlıdır', () => {
    for (const { ofset, etiket } of HATIRLATMA_SECENEKLERI) {
      expect(ofsetEtiketi(ofset)).toBe(etiket)
    }
  })
})

describe('ofsetEtiketi — katalog dışı yedek metin', () => {
  it('60 dakikadan azını dakika olarak yazar', () => {
    expect(ofsetEtiketi(45)).toBe('45 dk önce')
  })

  it('60 dk – 24 saat arasını saat olarak (yuvarlayarak) yazar', () => {
    expect(ofsetEtiketi(120)).toBe('2 saat önce')
    expect(ofsetEtiketi(90)).toBe('2 saat önce') // Math.round(1.5) = 2
    expect(ofsetEtiketi(23 * 60)).toBe('23 saat önce')
  })

  it('24 saat ve üzerini gün olarak yazar', () => {
    expect(ofsetEtiketi(2 * 24 * 60)).toBe('2 gün önce')
    expect(ofsetEtiketi(10 * 24 * 60)).toBe('10 gün önce')
  })
})
