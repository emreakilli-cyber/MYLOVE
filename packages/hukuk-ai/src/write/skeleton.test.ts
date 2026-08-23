import { describe, expect, it } from 'vitest'
import { extractSkeleton } from './skeleton'

const PETITION = `
I. GİRİŞ

1. Taraflar arasında imzalanan kira sözleşmesi gereğince...
2. Davalı, sözleşme koşullarına aykırı davranmıştır.

II. HUKUKİ SEBEPLER

a) 6098 sayılı Türk Borçlar Kanunu
b) 6100 sayılı Hukuk Muhakemeleri Kanunu

SONUÇ VE İSTEM

3. Yukarıda arz edilen nedenlerle davanın kabulüne karar verilmesini arz ve talep ederim.
`

describe('extractSkeleton (M8.2)', () => {
  it('roma rakamlı üst başlıkları tanır', () => {
    const skeleton = extractSkeleton(PETITION)
    const romans = skeleton.sections.filter((s) => s.numberingStyle === 'roman-dot')
    expect(romans.map((s) => s.title)).toEqual(['GİRİŞ', 'HUKUKİ SEBEPLER'])
    expect(romans.every((s) => s.level === 1)).toBe(true)
  })

  it('numarasız büyük harf başlığı tanır', () => {
    const skeleton = extractSkeleton(PETITION)
    expect(skeleton.sections.some((s) => s.title === 'SONUÇ VE İSTEM' && s.numberingStyle === 'none')).toBe(
      true,
    )
  })

  it('arap rakamlı maddeleri tanır', () => {
    const skeleton = extractSkeleton(PETITION)
    const arabic = skeleton.sections.filter((s) => s.numberingStyle === 'arabic-dot')
    expect(arabic).toHaveLength(3)
    expect(arabic[0]?.level).toBe(2)
  })

  it('harf parantezli maddeleri tanır', () => {
    const skeleton = extractSkeleton(PETITION)
    const letters = skeleton.sections.filter((s) => s.numberingStyle === 'letter-paren')
    expect(letters.map((s) => s.title)).toEqual([
      '6098 sayılı Türk Borçlar Kanunu',
      '6100 sayılı Hukuk Muhakemeleri Kanunu',
    ])
  })

  it('baskın numaralandırma biçimini bulur (en çok görülen)', () => {
    const skeleton = extractSkeleton(PETITION)
    // arabic-dot: 3, roman-dot: 2, letter-paren: 2 -> arabic-dot kazanır
    expect(skeleton.dominantNumberingStyle).toBe('arabic-dot')
  })

  it('sırayı korur (lineIndex artan)', () => {
    const skeleton = extractSkeleton(PETITION)
    const indices = skeleton.sections.map((s) => s.lineIndex)
    expect([...indices].sort((a, b) => a - b)).toEqual(indices)
  })

  it('başlıksız düz metinde boş sonuç ve none döner', () => {
    const skeleton = extractSkeleton('Bu bir düz paragraftır. Başlık yoktur.')
    expect(skeleton.sections).toEqual([])
    expect(skeleton.dominantNumberingStyle).toBe('none')
  })

  it('eşitlikte belgede önce görülen biçim kazanır', () => {
    const doc = '1. birinci madde\na) ikinci madde'
    const skeleton = extractSkeleton(doc)
    expect(skeleton.dominantNumberingStyle).toBe('arabic-dot')
  })
})
