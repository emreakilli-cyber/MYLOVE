import { describe, expect, it } from 'vitest'
import { extractSkeleton } from './skeleton'

const ROMAN_PETITION = `İSTANBUL NÖBETÇİ ASLİYE HUKUK MAHKEMESİ'NE

DAVACI: Ahmet Yılmaz
DAVALI: Mehmet Demir

I. OLAY
Müvekkilim ile davalı arasında imzalanan sözleşme feshedilmiştir.

II. HUKUKİ SEBEPLER
6098 sayılı Türk Borçlar Kanunu ilgili hükümleri uyarınca talep hakkı doğmuştur.

SONUÇ VE İSTEM
Yukarıda arz ve izah edilen nedenlerle davanın kabulüne karar verilmesini talep ederiz.

Saygılarımla,
Davacı Vekili`

describe('extractSkeleton (M8.2)', () => {
  it('Romen numaralı başlıkları ve numarasız BÜYÜK HARF başlığı bulur', () => {
    const skeleton = extractSkeleton(ROMAN_PETITION)

    expect(skeleton.sectionOrder).toEqual(['OLAY', 'HUKUKİ SEBEPLER', 'SONUÇ VE İSTEM'])
    expect(skeleton.headings.map((h) => h.numbering)).toEqual(['roman', 'roman', 'none'])
  })

  it('baskın numaralandırma şemasını numarasızları saymadan belirler', () => {
    const skeleton = extractSkeleton(ROMAN_PETITION)
    expect(skeleton.numberingScheme).toBe('roman')
  })

  it('hitap satırını (mahkemeye NE eki) başlık saymaz', () => {
    const skeleton = extractSkeleton(ROMAN_PETITION)
    expect(skeleton.sectionOrder.some((section) => section.includes('MAHKEMESİ'))).toBe(false)
  })

  it('karışık şema kullanan belgede "mixed" döner', () => {
    const mixed = `1. Giriş\nAçıklama metni burada.\n\nA) Sonuç\nSonuç metni burada.`
    const skeleton = extractSkeleton(mixed)
    expect(skeleton.numberingScheme).toBe('mixed')
    expect(skeleton.sectionOrder).toEqual(['Giriş', 'Sonuç'])
  })

  it('hiç başlık yoksa boş iskelet döner, çökmez', () => {
    const skeleton = extractSkeleton('Sıradan bir paragraf metni. Başka bir cümle.')
    expect(skeleton.headings).toEqual([])
    expect(skeleton.numberingScheme).toBe('none')
    expect(skeleton.sectionOrder).toEqual([])
  })

  it('arabic-paren ve letter-dot şemalarını ayırt eder', () => {
    const arabicParen = extractSkeleton('1) Giriş\nMetin.\n\n2) Sonuç\nMetin.')
    expect(arabicParen.numberingScheme).toBe('arabic-paren')

    const letterDot = extractSkeleton('A. Giriş\nMetin.\n\nB. Sonuç\nMetin.')
    expect(letterDot.numberingScheme).toBe('letter-dot')
  })
})
