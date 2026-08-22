import { describe, expect, it } from 'vitest'
import { StyleProfileBuilder, mergeState } from './styleProfile'

const DOC_A = `İSTANBUL 4. ASLİYE HUKUK MAHKEMESİ'NE

AÇIKLAMALAR

Müvekkilim ile davalı taraf arasında imzalanan sözleşme gereğince davalı taraf, sözleşmede belirtilen edimini süresinde yerine getirmemiş ve müvekkilime ciddi maddi zarar vermiştir. Bu durum 6098 sayılı Türk Borçlar Kanunu hükümlerine aykırılık teşkil etmektedir.

SONUÇ VE İSTEM

Yukarıda arz ve izah edilen nedenlerle davanın kabulüne karar verilmesini saygılarımla arz ve talep ederim.`

const DOC_B = `ANKARA 2. ASLİYE TİCARET MAHKEMESİ'NE

AÇIKLAMALAR

Davalı müvekkilim ile aralarındaki ticari ilişki kapsamında 6102 sayılı Türk Ticaret Kanunu hükümleri uyarınca sorumludur. Yargıtay 3. Hukuk Dairesi'nin E. 2019/1234 K. 2020/5678 sayılı kararında da benzer bir olayda davalının sorumluluğuna hükmedilmiştir. Bu emsal karar, somut olayımızla büyük ölçüde örtüşmektedir ve müvekkilimin talebini haklı kılmaktadır.

Kısa not.

SONUÇ VE İSTEM

Yukarıda açıklanan nedenlerle davanın kabulüne karar verilmesini saygılarımızla arz ve talep ederiz.`

describe('StyleProfileBuilder (M8.3 / M8.4)', () => {
  it('boş profilde sonsuz değer sızdırmaz — JSON güvenli', () => {
    const profile = new StyleProfileBuilder().build()
    expect(profile.sentenceLength).toEqual({ count: 0, mean: 0, min: 0, max: 0, stdDev: 0 })
    expect(profile.documentCount).toBe(0)
    expect(profile.excerpts).toEqual([])
    expect(JSON.parse(JSON.stringify(profile))).toEqual(profile)
  })

  it('belge sayısını ve dağılım istatistiklerini artımlı biriktirir', () => {
    const builder = new StyleProfileBuilder()
    builder.add('a', DOC_A)
    builder.add('b', DOC_B)
    const profile = builder.build()

    expect(profile.documentCount).toBe(2)
    expect(profile.paragraphLength.count).toBeGreaterThan(0)
    expect(profile.sentenceLength.count).toBeGreaterThan(0)
    expect(profile.sentenceLength.min).toBeLessThanOrEqual(profile.sentenceLength.mean)
    expect(profile.sentenceLength.mean).toBeLessThanOrEqual(profile.sentenceLength.max)
  })

  it('kalıp ifadeleri bulur', () => {
    const builder = new StyleProfileBuilder()
    builder.add('a', DOC_A)
    builder.add('b', DOC_B)
    const phrases = builder.build().formulaicPhrases.map((p) => p.phrase)

    expect(phrases).toContain('yukarıda arz ve izah edilen nedenlerle')
    expect(phrases).toContain('saygılarımla arz ve talep ederim')
    expect(phrases).toContain('yukarıda açıklanan nedenlerle')
    expect(phrases).toContain('saygılarımızla arz ve talep ederiz')
  })

  it('hitap ve kapanış kalıplarını yakalar', () => {
    const builder = new StyleProfileBuilder()
    builder.add('a', DOC_A)
    const profile = builder.build()

    expect(profile.salutations.map((s) => s.phrase)).toContain("İSTANBUL 4. ASLİYE HUKUK MAHKEMESİ'NE")
    expect(profile.closings[0]?.phrase).toContain('arz ve talep ederim')
  })

  it('atıf biçimini çıkarır: mevzuat sayısı ve E./K. sırası', () => {
    const builder = new StyleProfileBuilder()
    builder.add('a', DOC_A)
    builder.add('b', DOC_B)
    const { citationStyle } = builder.build()

    expect(citationStyle.lawReferenceCount).toBe(2)
    expect(citationStyle.caseReferenceCount).toBe(1)
    expect(citationStyle.caseOrder).toBe('e-first')
  })

  it('atıf yoksa "unknown" döner', () => {
    const builder = new StyleProfileBuilder()
    builder.add('x', 'Sıradan bir metin, atıf içermez.')
    expect(builder.build().citationStyle.caseOrder).toBe('unknown')
  })

  it('terim tercihlerini sayar', () => {
    const builder = new StyleProfileBuilder()
    builder.add('a', DOC_A)
    const terms = builder.build().preferredTerms.map((t) => t.phrase)
    expect(terms).toContain('davalı taraf')
  })

  it('her belgeden yalnız içerik yoğun (≥8 kelime) paragrafları temsilî alıntı yapar', () => {
    const builder = new StyleProfileBuilder()
    builder.add('b', DOC_B)
    const excerpts = builder.build().excerpts

    expect(excerpts.every((e) => e.documentId === 'b')).toBe(true)
    expect(excerpts.some((e) => e.text === 'Kısa not.')).toBe(false)
    expect(excerpts.length).toBeGreaterThan(0)
    expect(excerpts.length).toBeLessThanOrEqual(3)
  })

  it('numaralandırma biçimi baskın türü yansıtır', () => {
    const builder = new StyleProfileBuilder()
    builder.add('a', 'I. Giriş\nII. Gelişme')
    builder.add('b', 'I. Giriş\nII. Gelişme\nIII. Sonuç')
    expect(builder.build().numberingStyle).toBe('roman')
  })

  it('toState/fromState devam ettirilebilir — durum aynı sonucu üretir', () => {
    const first = new StyleProfileBuilder()
    first.add('a', DOC_A)
    const resumed = StyleProfileBuilder.fromState(first.toState())
    resumed.add('b', DOC_B)

    const combined = new StyleProfileBuilder()
    combined.add('a', DOC_A)
    combined.add('b', DOC_B)

    expect(resumed.build().documentCount).toBe(combined.build().documentCount)
    expect(resumed.build().citationStyle).toEqual(combined.build().citationStyle)
  })

  it('mergeState, iki bağımsız durumu sıralı add() ile aynı sonuca birleştirir', () => {
    const builderA = new StyleProfileBuilder()
    builderA.add('a', DOC_A)

    const builderB = new StyleProfileBuilder()
    builderB.add('b', DOC_B)

    const merged = StyleProfileBuilder.fromState(mergeState(builderA.toState(), builderB.toState())).build()

    const sequential = new StyleProfileBuilder()
    sequential.add('a', DOC_A)
    sequential.add('b', DOC_B)
    const sequentialProfile = sequential.build()

    expect(merged.documentCount).toBe(sequentialProfile.documentCount)
    expect(merged.sentenceLength.count).toBe(sequentialProfile.sentenceLength.count)
    expect(merged.sentenceLength.mean).toBeCloseTo(sequentialProfile.sentenceLength.mean, 6)
    expect(merged.paragraphLength.count).toBe(sequentialProfile.paragraphLength.count)
    expect(merged.paragraphLength.mean).toBeCloseTo(sequentialProfile.paragraphLength.mean, 6)
    expect(merged.citationStyle).toEqual(sequentialProfile.citationStyle)
    expect(merged.numberingStyle).toBe(sequentialProfile.numberingStyle)
    expect(merged.excerpts.length).toBe(sequentialProfile.excerpts.length)
  })
})
