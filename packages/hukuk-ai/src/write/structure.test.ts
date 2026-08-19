import { describe, expect, it } from 'vitest'
import { extractStructure } from './structure'

describe('extractStructure (M8.2)', () => {
  it('arabik numaralandırmayı ve iç içe seviyeleri tanır', () => {
    const text = `
      1. AÇIKLAMALAR
      1.1. Taraflar arasındaki ilişki
      1.2. Uyuşmazlığın konusu
      2. HUKUKİ SEBEPLER
      3. SONUÇ VE İSTEM
    `
    const structure = extractStructure(text)

    expect(structure.numberingStyle).toBe('arabic')
    expect(structure.sectionOrder).toEqual(['AÇIKLAMALAR', 'HUKUKİ SEBEPLER', 'SONUÇ VE İSTEM'])
    const nested = structure.headings.find((h) => h.text === 'Taraflar arasındaki ilişki')
    expect(nested?.level).toBe(2)
  })

  it('roma rakamlı numaralandırmayı tanır', () => {
    const text = `
      I. GİRİŞ
      II. OLAYLAR
      III. SONUÇ
    `
    const structure = extractStructure(text)
    expect(structure.numberingStyle).toBe('roman')
    expect(structure.sectionOrder).toEqual(['GİRİŞ', 'OLAYLAR', 'SONUÇ'])
  })

  it('harf numaralandırmasını tanır', () => {
    const text = `
      A) DAVACI
      B) DAVALI
      C) KONU
    `
    const structure = extractStructure(text)
    expect(structure.numberingStyle).toBe('letter')
    expect(structure.sectionOrder).toEqual(['DAVACI', 'DAVALI', 'KONU'])
  })

  it('numarasız BÜYÜK HARF başlıkları yakalar, numaralandırma biçimi none kalır', () => {
    const text = `
      SONUÇ VE İSTEM
      Yukarıda arz ve izah edilen nedenlerle davanın kabulünü talep ederiz.
    `
    const structure = extractStructure(text)
    expect(structure.numberingStyle).toBe('none')
    expect(structure.sectionOrder).toEqual(['SONUÇ VE İSTEM'])
  })

  it('düz metinde başlık yoksa çökmez, boş döner', () => {
    const structure = extractStructure('Bu sıradan bir paragraf cümlesidir, başlık içermez.')
    expect(structure.headings).toEqual([])
    expect(structure.sectionOrder).toEqual([])
    expect(structure.numberingStyle).toBe('none')
  })

  it('boş metinde çökmez', () => {
    expect(extractStructure('')).toEqual({ headings: [], sectionOrder: [], numberingStyle: 'none' })
  })

  it('baskın numaralandırma çoğunluğa göre seçilir', () => {
    const text = `
      1. GİRİŞ
      2. OLAYLAR
      3. DELİLLER
      A) EK BELGE
    `
    expect(extractStructure(text).numberingStyle).toBe('arabic')
  })
})
