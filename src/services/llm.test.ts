import { afterEach, describe, expect, it, vi } from 'vitest'
import { LlmHatasi, llmDurumu, llmSaglayiciAdi, llmSor } from './llm'
import type { Ayarlar } from '../domain/types'

/*
 * LLM adaptörünün durum mantığı ve ağ çağrısının (llmSor) hata/zaman-aşımı
 * davranışı. Varsayılan kapalı ve yapılandırma kapısı doğru çalışmalı; açıkken
 * yanıt vermeyen bir uç nokta UI'yı sonsuza dek askıda bırakmamalı.
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

const hazir: Ayarlar = {
  ...temel,
  llmEtkin: true,
  llmUcNokta: 'https://api.example.com/v1/chat/completions',
  llmAnahtar: 'sk-test',
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

describe('llmSor', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('başarılı yanıtın içeriğini kırpıp döndürür', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '  Merhaba  ' } }] }),
      })),
    )
    await expect(llmSor(hazir, 'özet', 'soru')).resolves.toBe('Merhaba')
  })

  it('OK olmayan yanıtta LlmHatasi (durum koduyla) fırlatır', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })),
    )
    await expect(llmSor(hazir, 'özet', 'soru')).rejects.toBeInstanceOf(LlmHatasi)
  })

  it('boş içerikte LlmHatasi fırlatır', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ choices: [] }) })),
    )
    await expect(llmSor(hazir, 'özet', 'soru')).rejects.toBeInstanceOf(LlmHatasi)
  })

  it('yanıt vermeyen uç noktada zaman aşımıyla LlmHatasi fırlatır (askıda kalmaz)', async () => {
    // Uç nokta hiç çözülmez; yalnızca abort sinyalinde reddeder.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, opts: { signal: AbortSignal }) =>
          new Promise((_res, rej) => {
            opts.signal.addEventListener('abort', () =>
              rej(new Error('aborted')),
            )
          }),
      ),
    )
    // Kısa zaman aşımı (20ms) ile testi hızlı tut.
    await expect(llmSor(hazir, 'özet', 'soru', 20)).rejects.toThrow(
      /yanıt vermedi/,
    )
  })
})
