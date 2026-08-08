import { describe, expect, it } from 'vitest'
import { extractSkeleton } from './skeleton'

const ARABIC_DOT_PETITION = `İSTANBUL 3. ASLİYE HUKUK MAHKEMESİ'NE

DAVACI
Ahmet Yılmaz

DAVALI
Mehmet Demir

KONU
Alacak davası hakkındadır.

AÇIKLAMALAR

1. Davalı ile aramızda 01.01.2024 tarihli sözleşme imzalanmıştır.

2. Davalı sözleşme bedelini ödememiştir.

HUKUKİ SEBEPLER
TBK ve ilgili mevzuat.

SONUÇ VE İSTEM
Davanın kabulüne karar verilmesini saygıyla arz ve talep ederim.

Saygılarımla`

describe('extractSkeleton (M8.2)', () => {
  it('ana başlıkları ve numaralı alt maddeleri sırayla çıkarır', () => {
    const skeleton = extractSkeleton(ARABIC_DOT_PETITION)

    const headings = skeleton.sections.map((section) => section.heading)
    expect(headings).toEqual([
      "İSTANBUL 3. ASLİYE HUKUK MAHKEMESİ'NE",
      'DAVACI',
      'DAVALI',
      'KONU',
      'AÇIKLAMALAR',
      '1. Davalı ile aramızda 01.01.2024 tarihli sözleşme imzalanmıştır.',
      '2. Davalı sözleşme bedelini ödememiştir.',
      'HUKUKİ SEBEPLER',
      'SONUÇ VE İSTEM',
    ])
  })

  it('numaralı maddeleri seviye 2, ana başlıkları seviye 1 işaretler', () => {
    const skeleton = extractSkeleton(ARABIC_DOT_PETITION)
    const byHeading = new Map(skeleton.sections.map((section) => [section.heading, section]))

    expect(byHeading.get('DAVACI')?.level).toBe(1)
    expect(byHeading.get('1. Davalı ile aramızda 01.01.2024 tarihli sözleşme imzalanmıştır.')?.level).toBe(2)
  })

  it('sıra numaraları belgedeki geçiş sırasını yansıtır', () => {
    const skeleton = extractSkeleton(ARABIC_DOT_PETITION)
    const orders = skeleton.sections.map((section) => section.order)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
  })

  it('baskın numaralandırma biçimini tespit eder', () => {
    expect(extractSkeleton(ARABIC_DOT_PETITION).numberingStyle).toBe('arabic-dot')
  })

  it('roma rakamı biçimini tespit eder', () => {
    const text = 'I. GİRİŞ\nBu bölümde olaylar anlatılır.\n\nII. OLAYLAR\nDetaylar burada.'
    expect(extractSkeleton(text).numberingStyle).toBe('roman')
  })

  it('harf biçimini tespit eder', () => {
    const text = 'A) TARAFLAR\nMetin.\n\nB) OLAYLAR\nMetin.'
    expect(extractSkeleton(text).numberingStyle).toBe('letter')
  })

  it('numaralı başlık yoksa "none" döner', () => {
    const text = 'DAVACI\nAhmet Yılmaz\n\nDAVALI\nMehmet Demir'
    expect(extractSkeleton(text).numberingStyle).toBe('none')
  })

  it('birbirine yakın sayıda farklı biçim varsa "mixed" döner', () => {
    const text = '1. Birinci madde\nA) İkinci madde'
    expect(extractSkeleton(text).numberingStyle).toBe('mixed')
  })

  it('düz paragrafları başlık saymaz', () => {
    const text =
      'Bu satır uzun ve küçük harfli bir paragraftır, herhangi bir başlık deseni içermez ve satır başında numara da yoktur.'
    expect(extractSkeleton(text).sections).toEqual([])
  })

  it('boş metinde çökmez, boş sonuç döner', () => {
    expect(extractSkeleton('')).toEqual({ sections: [], numberingStyle: 'none' })
  })
})
