import { describe, expect, it } from 'vitest'
import { metinHash, onayGerekli } from './onayIslemleri'
import { HUKUKI_METIN_SURUMU } from '../onboarding/hukukiMetin'
import type { Ayarlar } from '../domain/types'

const temel: Ayarlar = {
  id: 'tekil',
  kullaniciAdi: 'Test',
  unvan: 'Avukat',
  hatirlatmaOfsetleri: {},
  varsayilanKanallar: ['uygulama'],
  kilitEtkin: false,
  llmEtkin: false,
}

describe('metinHash', () => {
  it('SHA-256 hex üretir ve deterministiktir', async () => {
    const a = await metinHash('deneme')
    const b = await metinHash('deneme')
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(await metinHash('başka')).not.toBe(a)
  })
})

describe('onayGerekli', () => {
  it('kayıt yoksa onay gerekir', () => {
    expect(onayGerekli(undefined)).toBe(true)
    expect(onayGerekli(temel)).toBe(true)
  })

  it('güncel sürüm onaylıysa gerekmez', () => {
    expect(
      onayGerekli({
        ...temel,
        hukukiOnay: {
          zaman: '2026-08-05T00:00:00.000Z',
          surum: HUKUKI_METIN_SURUMU,
          hash: 'x',
        },
      }),
    ).toBe(false)
  })

  it('sürüm değişince yeniden onay gerekir', () => {
    expect(
      onayGerekli({
        ...temel,
        hukukiOnay: {
          zaman: '2026-08-05T00:00:00.000Z',
          surum: 'eski-surum',
          hash: 'x',
        },
      }),
    ).toBe(true)
  })
})
