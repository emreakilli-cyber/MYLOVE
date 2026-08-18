import { describe, expect, it } from 'vitest'
import { extractSkeleton } from './skeleton'

describe('extractSkeleton (M8.2)', () => {
  it('ondalık numaralandırmayı tanır', () => {
    const text = [
      '1. KONU',
      'Bu dilekçe şu konuyu kapsar.',
      '',
      '2. AÇIKLAMALAR',
      'Ayrıntılar burada.',
      '',
      '3. SONUÇ VE İSTEM',
      'Talebimiz kabulüdür.',
    ].join('\n')

    const skeleton = extractSkeleton(text)

    expect(skeleton.numberingScheme).toBe('decimal')
    expect(skeleton.sectionOrder).toEqual(['KONU', 'AÇIKLAMALAR', 'SONUÇ VE İSTEM'])
    expect(skeleton.headings[0]).toMatchObject({ numberLabel: '1', text: 'KONU', line: 0 })
  })

  it('roma rakamı numaralandırmayı tanır', () => {
    const text = 'I. GİRİŞ\nmetin\nII. GELİŞME\nmetin\nIII. SONUÇ\nmetin'
    const skeleton = extractSkeleton(text)

    expect(skeleton.numberingScheme).toBe('roman')
    expect(skeleton.sectionOrder).toEqual(['GİRİŞ', 'GELİŞME', 'SONUÇ'])
  })

  it('harf numaralandırmayı tanır', () => {
    const text = 'A) Taraflar\nmetin\nB) Talep\nmetin'
    const skeleton = extractSkeleton(text)

    expect(skeleton.numberingScheme).toBe('alpha')
    expect(skeleton.sectionOrder).toEqual(['Taraflar', 'Talep'])
  })

  it('karışık numaralandırma şemasını "mixed" işaretler', () => {
    const text = '1. Giriş\nmetin\nII. Sonuç\nmetin'
    expect(extractSkeleton(text).numberingScheme).toBe('mixed')
  })

  it('numarasız ama bilinen büyük harf başlıkları da yakalar', () => {
    const text = 'DELİLLER\nTanık ifadesi.\n\nSONUÇ VE İSTEM\nKabulünü talep ederiz.'
    const skeleton = extractSkeleton(text)

    expect(skeleton.numberingScheme).toBe('none')
    expect(skeleton.sectionOrder).toEqual(['DELİLLER', 'SONUÇ VE İSTEM'])
  })

  it('başlıksız metinde boş sonuç döner, çökmez', () => {
    const skeleton = extractSkeleton('Sıradan bir paragraf, başlık içermiyor.')
    expect(skeleton.headings).toEqual([])
    expect(skeleton.numberingScheme).toBe('none')
  })

  it('gövde metnindeki normal cümleleri başlık saymaz', () => {
    const text = '1. KONU\nMüvekkil, davalıdan alacağının tahsilini talep etmektedir bu dilekçe ile birlikte.'
    const skeleton = extractSkeleton(text)
    expect(skeleton.sectionOrder).toEqual(['KONU'])
  })
})
