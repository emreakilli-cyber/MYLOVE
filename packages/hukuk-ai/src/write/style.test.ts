import { describe, expect, it } from 'vitest'
import {
  emptyStyleProfile,
  extractStyleProfile,
  meanParagraphSentences,
  meanSentenceWords,
  mergeStyleProfiles,
} from './style'

const PETITION_A = `1. KONU
Müvekkilin alacağının tahsili talebimizdir. Davalı borcunu ödememiştir.

2. AÇIKLAMALAR
Yukarıda arz ve izah edilen nedenlerle davanın kabulünü talep ederiz. Yukarıda arz ve izah edilen nedenlerle ayrıca faiz talep ederiz.

Sayın Mahkemenizden davanın kabulünü arz ve talep ederim.
Saygılarımla.`

const PETITION_B = `I. GİRİŞ
Taraflar arasındaki sözleşme feshedilmiştir. Fesih haksızdır.

II. SONUÇ
Yukarıda arz ve izah edilen nedenlerle zararın tazminini talep ederiz.

Sayın Mahkemenizden kabulüne karar verilmesini arz ve talep ederim.
Saygılarımla.`

describe('extractStyleProfile (M8.3)', () => {
  it('cümle ve paragraf uzunluğu istatistiği üretir', () => {
    const profile = extractStyleProfile(PETITION_A)
    expect(profile.documentCount).toBe(1)
    expect(profile.sentenceLength.count).toBeGreaterThan(0)
    expect(meanSentenceWords(profile)).toBeGreaterThan(0)
    expect(meanParagraphSentences(profile)).toBeGreaterThan(0)
  })

  it('numaralandırma biçimini profile yansıtır', () => {
    const profile = extractStyleProfile(PETITION_A)
    expect(profile.numberingStyle.decimal).toBe(1)
    expect(profile.numberingStyle.roman).toBe(0)
  })

  it('hitap ve kapanış kalıplarını yakalar', () => {
    const profile = extractStyleProfile(PETITION_A)
    expect(profile.salutations.some((s) => s.phrase.includes('Sayın Mahkemenizden'))).toBe(true)
    expect(profile.closings.some((c) => c.phrase.startsWith('Saygılarımla'))).toBe(true)
  })

  it('tekrarlanan kalıp ifadeleri (n-gram) bulur', () => {
    const profile = extractStyleProfile(PETITION_A)
    expect(profile.boilerplatePhrases.some((p) => p.phrase.includes('yukarıda arz ve izah'))).toBe(true)
  })

  it('boş metinde çökmez, sıfır istatistik döner', () => {
    const profile = extractStyleProfile('')
    expect(profile.sentenceLength.count).toBe(0)
    expect(meanSentenceWords(profile)).toBe(0)
  })
})

describe('mergeStyleProfiles (M8.4) — artımlı birleştirme', () => {
  it('belge sayısını ve istatistik toplamlarını doğru biriktirir', () => {
    const a = extractStyleProfile(PETITION_A)
    const b = extractStyleProfile(PETITION_B)
    const merged = mergeStyleProfiles(a, b)

    expect(merged.documentCount).toBe(2)
    expect(merged.sentenceLength.count).toBe(a.sentenceLength.count + b.sentenceLength.count)
    expect(merged.sentenceLength.total).toBe(a.sentenceLength.total + b.sentenceLength.total)
  })

  it('boş profille birleşim değişiklik yapmaz (birim eleman)', () => {
    const a = extractStyleProfile(PETITION_A)
    const merged = mergeStyleProfiles(a, emptyStyleProfile())
    expect(merged.documentCount).toBe(a.documentCount)
    expect(meanSentenceWords(merged)).toBeCloseTo(meanSentenceWords(a))
  })

  it('birleştirme sırası sonucu değiştirmez (komütatif)', () => {
    const a = extractStyleProfile(PETITION_A)
    const b = extractStyleProfile(PETITION_B)
    const ab = mergeStyleProfiles(a, b)
    const ba = mergeStyleProfiles(b, a)
    expect(ab.documentCount).toBe(ba.documentCount)
    expect(ab.sentenceLength).toEqual(ba.sentenceLength)
  })

  it('ortak kalıp ifadeler frekans birleştirmede toplanır', () => {
    const a = extractStyleProfile(PETITION_A)
    const b = extractStyleProfile(PETITION_B)
    const merged = mergeStyleProfiles(a, b)

    const aCount = a.boilerplatePhrases.find((p) => p.phrase.includes('yukarıda arz ve izah'))?.count ?? 0
    const bCount = b.boilerplatePhrases.find((p) => p.phrase.includes('yukarıda arz ve izah'))?.count ?? 0
    const mergedCount = merged.boilerplatePhrases.find((p) => p.phrase.includes('yukarıda arz ve izah'))?.count

    expect(mergedCount).toBe(aCount + bCount)
  })

  it('numaralandırma biçimi sayaçları belge bazında birikir', () => {
    const a = extractStyleProfile(PETITION_A) // decimal
    const b = extractStyleProfile(PETITION_B) // roman
    const merged = mergeStyleProfiles(a, b)
    expect(merged.numberingStyle.decimal).toBe(1)
    expect(merged.numberingStyle.roman).toBe(1)
  })

  it('200 belge arka arkaya artımlı olarak birleştirilebilir (A8 bütçe kanıtı)', () => {
    let profile = emptyStyleProfile()
    for (let i = 0; i < 200; i += 1) {
      profile = mergeStyleProfiles(profile, extractStyleProfile(i % 2 === 0 ? PETITION_A : PETITION_B))
    }
    expect(profile.documentCount).toBe(200)
  })
})
