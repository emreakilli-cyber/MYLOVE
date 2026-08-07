import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _tercihleriSifirla,
  devirSorulmali,
  masaustuErisilebilir,
  sureMetni,
  sureOlc,
  sureTahminiMs,
  telefonTercihiKur,
  telefonTercihiVar,
} from './devir'

/*
 * Devir teslim mantığı. Varsayılan: masaüstü erişilebilir değil → devir
 * sorulmaz (iş sessizce telefonda). Süre tahmini uydurulmaz; yalnızca ölçümden.
 */

describe('devir — masaüstü erişilebilirliği', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('localStorage yoksa/erişilemezse false (sessizce telefon)', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(masaustuErisilebilir()).toBe(false)
  })

  it('bayrak "1" ise true', () => {
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (k === 'juris-masaustu' ? '1' : null),
    })
    expect(masaustuErisilebilir()).toBe(true)
  })
})

describe('devir — oturum tercihi', () => {
  beforeEach(() => _tercihleriSifirla())

  it('bir kez telefon seçilince tekrar sorulmaz', () => {
    vi.stubGlobal('localStorage', { getItem: () => '1' }) // masaüstü var
    expect(devirSorulmali('uzun-dilekce')).toBe(true)
    telefonTercihiKur('uzun-dilekce')
    expect(telefonTercihiVar('uzun-dilekce')).toBe(true)
    expect(devirSorulmali('uzun-dilekce')).toBe(false)
    // başka iş tipi hâlâ sorulur
    expect(devirSorulmali('toplu-belge')).toBe(true)
    vi.unstubAllGlobals()
  })

  it('masaüstü yoksa hiç sorulmaz', () => {
    vi.stubGlobal('localStorage', { getItem: () => null })
    expect(devirSorulmali('uzun-dilekce')).toBe(false)
    vi.unstubAllGlobals()
  })
})

describe('devir — süre tahmini (uydurma yok)', () => {
  it('ölçüm yoksa null döner', () => {
    expect(sureTahminiMs('toplu-belge')).toBe(null)
    expect(sureMetni(null)).toBe(null)
  })

  it('ölçümlerin ortalamasını verir', () => {
    sureOlc('uzun-dilekce', 1000)
    sureOlc('uzun-dilekce', 3000)
    expect(sureTahminiMs('uzun-dilekce')).toBe(2000)
    expect(sureMetni(2000)).toBe('~2,0 sn')
  })

  it('geçersiz ölçümü yok sayar', () => {
    sureOlc('toplu-belge', -5)
    sureOlc('toplu-belge', Number.NaN)
    expect(sureTahminiMs('toplu-belge')).toBe(null)
  })
})
