import { describe, expect, it } from 'vitest'
import { buildStyleProfile, mergeStyleProfile } from './style'

const PETITION_A = `İSTANBUL NÖBETÇİ ASLİYE HUKUK MAHKEMESİ'NE

I. OLAY
Müvekkilim ile davalı arasındaki sözleşme haksız biçimde feshedilmiş ve
müvekkilim ciddi bir tazminat talebiyle karşı karşıya kalmıştır. TBK m. 49
uyarınca sorumluluk doğmuştur.

II. SONUÇ VE İSTEM
Yukarıda arz ve izah edilen nedenlerle davanın kabulüne karar verilmesini
saygılarımla arz ederim.

Davacı Vekili`

const PETITION_B = `ANKARA NÖBETÇİ İŞ MAHKEMESİ'NE

I. OLAY
Müvekkilim işveren tarafından haksız yere işten çıkarılmış, kıdem ve ihbar
tazminatı ödenmemiştir. 4857 sayılı İş Kanunu md. 17 uyarınca talep hakkı
doğmuştur.

II. SONUÇ VE İSTEM
Açıklanan nedenlerle davanın kabulüne karar verilmesini saygılarımla arz
ederiz.

Davalı Vekili`

describe('buildStyleProfile (M8.3)', () => {
  it('cümle ve paragraf uzunluğu dağılımını üretir', () => {
    const profile = buildStyleProfile(PETITION_A)
    expect(profile.documentCount).toBe(1)
    expect(profile.sentenceLength.count).toBeGreaterThan(0)
    expect(profile.paragraphLength.count).toBeGreaterThan(0)
  })

  it('kalıp ifadeleri sayar', () => {
    const profile = buildStyleProfile(PETITION_A)
    const phrases = profile.stockPhrases.map((p) => p.phrase)
    expect(phrases).toContain('yukarıda arz ve izah edilen nedenlerle')
    expect(phrases).toContain('saygılarımla arz ederim')
  })

  it('hitap ve kapanış kalıplarını ayrı ayrı yakalar', () => {
    const profile = buildStyleProfile(PETITION_A)
    expect(profile.greetingPhrases.some((p) => p.phrase.includes('MAHKEMESİ'))).toBe(true)
    expect(profile.closingPhrases.some((p) => p.phrase === 'davacı vekili')).toBe(true)
  })

  it('atıf biçimini yakalar (kanun maddesi)', () => {
    const profile = buildStyleProfile(PETITION_A)
    expect(profile.citationPhrases.some((p) => p.phrase.includes('m. 49'))).toBe(true)
  })

  it('terim tercihini izler', () => {
    const profile = buildStyleProfile(PETITION_A)
    expect(profile.termPreferences.some((p) => p.phrase === 'tazminat')).toBe(true)
  })

  it('numaralandırma şemasını iskeletten alır', () => {
    const profile = buildStyleProfile(PETITION_A)
    expect(profile.numberingStyle).toEqual([{ phrase: 'roman', count: 1 }])
  })

  it('yeterince uzun paragraflardan temsilî örnek çıkarır', () => {
    const profile = buildStyleProfile(PETITION_A)
    expect(profile.sampleParagraphs.length).toBeGreaterThan(0)
    expect(profile.sampleParagraphs.length).toBeLessThanOrEqual(3)
  })

  it('kısa/boş metinde çökmez, sıfır dağılım döner', () => {
    const profile = buildStyleProfile('')
    expect(profile.sentenceLength).toEqual({ count: 0, mean: 0, min: 0, max: 0 })
    expect(profile.sampleParagraphs).toEqual([])
  })
})

describe('mergeStyleProfile (M8.4 — artımlı)', () => {
  it('base yoksa next aynen döner', () => {
    const next = buildStyleProfile(PETITION_A)
    expect(mergeStyleProfile(undefined, next)).toBe(next)
  })

  it('belge sayısı ve kalıp frekansları toplanır', () => {
    const a = buildStyleProfile(PETITION_A)
    const b = buildStyleProfile(PETITION_B)
    const merged = mergeStyleProfile(a, b)

    expect(merged.documentCount).toBe(2)
    const saygilar = merged.stockPhrases.find((p) => p.phrase === 'saygılarımla arz ederim')
    // A'da "arz ederim", B'de "arz ederiz" geçiyor — yalnız A'daki tam eşleşir.
    expect(saygilar?.count).toBe(1)
  })

  it('birleştirme sıradan bağımsızdır (documentCount ve toplam sayaçlar için)', () => {
    const a = buildStyleProfile(PETITION_A)
    const b = buildStyleProfile(PETITION_B)
    const c = buildStyleProfile(PETITION_A)

    const left = mergeStyleProfile(mergeStyleProfile(a, b), c)
    const right = mergeStyleProfile(a, mergeStyleProfile(b, c))

    expect(left.documentCount).toBe(right.documentCount)
    expect(left.sentenceLength.count).toBe(right.sentenceLength.count)
    expect(left.sentenceLength.mean).toBeCloseTo(right.sentenceLength.mean, 10)
    expect(left.stockPhrases.reduce((sum, p) => sum + p.count, 0)).toBe(
      right.stockPhrases.reduce((sum, p) => sum + p.count, 0),
    )
  })

  it('örnek paragraf sayısı üst sınırı aşmaz (birkaç KB kuralı, SORU S8)', () => {
    let profile = buildStyleProfile(PETITION_A)
    for (let i = 0; i < 20; i += 1) {
      profile = mergeStyleProfile(profile, buildStyleProfile(PETITION_B))
    }
    expect(profile.sampleParagraphs.length).toBeLessThanOrEqual(24)
  })
})
