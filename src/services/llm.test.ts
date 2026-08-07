import { describe, expect, it } from 'vitest'
import { llmDurumu, llmSaglayiciAdi } from './llm'
import type { Ayarlar } from '../domain/types'

/*
 * LLM adaptörünün saf/durum mantığı. Ağ çağrısı (llmSor) burada test edilmez;
 * varsayılan kapalı ve yapılandırma kapısı doğru çalışmalı.
 */

const temel: Ayarlar = {
  id: 'tekil',
  kullaniciAdi: 'Test',
  unvan: 'Avukat',
  hatirlatmaOfsetleri: {},
  varsayilanKanallar: ['uygulama'],
  kilitEtkin: false,
  llmEtkin: false,
}

describe('llmDurumu', () => {
  it('varsayılan kapalı', () => {
    expect(llmDurumu(temel)).toBe('kapali')
    expect(llmDurumu(undefined)).toBe('kapali')
  })

  it('açık ama eksik yapılandırma → yapilandirilmadi', () => {
    expect(llmDurumu({ ...temel, llmEtkin: true })).toBe('yapilandirilmadi')
    expect(
      llmDurumu({ ...temel, llmEtkin: true, llmUcNokta: 'https://x/y' }),
    ).toBe('yapilandirilmadi')
  })

  it('açık + uç nokta + anahtar → hazir', () => {
    expect(
      llmDurumu({
        ...temel,
        llmEtkin: true,
        llmUcNokta: 'https://api.example.com/v1/chat/completions',
        llmAnahtar: 'sk-test',
      }),
    ).toBe('hazir')
  })
})

describe('llmSaglayiciAdi', () => {
  it('uç noktanın ana bilgisayarını verir', () => {
    expect(
      llmSaglayiciAdi({
        ...temel,
        llmUcNokta: 'https://api.openai.com/v1/chat/completions',
      }),
    ).toBe('api.openai.com')
  })

  it('uç nokta yoksa nötr metin', () => {
    expect(llmSaglayiciAdi(temel)).toBe('sağlayıcınız')
  })
})
