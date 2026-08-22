import { describe, expect, it } from 'vitest'
import { extractStructure } from './structure'

const PETITION = `İSTANBUL 4. ASLİYE HUKUK MAHKEMESİ'NE

DAVACI: Ahmet Yılmaz
DAVALI: Mehmet Kaya

AÇIKLAMALAR

1. Müvekkilim ile davalı arasında imzalanan sözleşme gereği...
2. Davalı edimini yerine getirmemiştir.
3. Bu nedenle zarar doğmuştur.

HUKUKİ SEBEPLER

TBK ve ilgili mevzuat.

SONUÇ VE İSTEM

Yukarıda açıklanan nedenlerle davanın kabulüne karar verilmesini saygılarımla arz ve talep ederim.`

describe('extractStructure (M8.2)', () => {
  it('bölüm başlıklarını sırayla toplar', () => {
    const structure = extractStructure(PETITION)
    expect(structure.headings).toEqual([
      "İSTANBUL 4. ASLİYE HUKUK MAHKEMESİ'NE",
      'AÇIKLAMALAR',
      'HUKUKİ SEBEPLER',
      'SONUÇ VE İSTEM',
    ])
  })

  it('baskın numaralandırma biçimini bulur', () => {
    expect(extractStructure(PETITION).numberingStyle).toBe('arabic')
  })

  it('numaralandırma yoksa "none" döner', () => {
    expect(extractStructure('Sıradan bir paragraf. Başka bir cümle.').numberingStyle).toBe('none')
    expect(extractStructure('Sıradan bir paragraf. Başka bir cümle.').headings).toEqual([])
  })

  it('roma rakamlı numaralandırmayı tanır', () => {
    const text = 'I. Giriş\nII. Gelişme\nIII. Sonuç'
    expect(extractStructure(text).numberingStyle).toBe('roman')
  })

  it('harf numaralandırmayı tanır', () => {
    const text = 'a) birinci madde\nb) ikinci madde\nc) üçüncü madde'
    expect(extractStructure(text).numberingStyle).toBe('letter')
  })

  it('DAVACI: gibi başlık olmayan büyük harfli olmayan satırları başlık saymaz', () => {
    expect(extractStructure(PETITION).headings).not.toContain('DAVACI: Ahmet Yılmaz')
  })

  it('boş metinde çökmez, boş yapı döner', () => {
    expect(extractStructure('')).toEqual({ headings: [], numberingStyle: 'none' })
  })

  it('eşit sayıda farklı numaralandırma türünde sonuç sabittir (arabic > roman > letter)', () => {
    const text = '1. birinci\nI. birinci'
    expect(extractStructure(text).numberingStyle).toBe('arabic')
  })
})
