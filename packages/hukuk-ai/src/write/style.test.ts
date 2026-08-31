import { describe, expect, it } from 'vitest'
import {
  aggregateMean,
  aggregateMedian,
  buildStyleProfile,
  emptyStyleProfile,
  extractStyleFeatures,
  mergeStyleProfiles,
} from './style'

const PETITION_1 = `
I. GİRİŞ

1. Davacı müvekkil ile davalı arasında kira sözleşmesi imzalanmıştır. Sözleşme feshedilmiştir.
2. Davalı, ihtarnameye rağmen tahliye etmemiştir.

SONUÇ VE İSTEM

Yukarıda arz ve izah edilen nedenlerle davanın kabulüne karar verilmesini saygılarımla arz ederim.
`

const PETITION_2 = `
I. AÇIKLAMALAR

1. Müvekkil, işvereni tarafından haksız yere işten çıkarılmıştır. Bu nedenle tazminat talep edilmektedir.
2. Yargıtay 9. HD, E. 2021/123, K. 2022/456 sayılı kararında da benzer bir olayda işçi lehine karar verilmiştir.

SONUÇ VE İSTEM

Yukarıda açıklanan nedenlerle davanın kabulüne karar verilmesini saygılarımla arz ederim.
`

describe('extractStyleFeatures (M8.3)', () => {
  it('tek belge documentCount = 1 üretir', () => {
    expect(extractStyleFeatures(PETITION_1).documentCount).toBe(1)
  })

  it('cümle ve paragraf uzunluğu dağılımını çıkarır', () => {
    const profile = extractStyleFeatures(PETITION_1)
    expect(profile.sentenceWordCounts.count).toBeGreaterThan(0)
    expect(aggregateMean(profile.sentenceWordCounts)).toBeGreaterThan(0)
    expect(profile.paragraphSentenceCounts.count).toBeGreaterThan(0)
  })

  it('kalıp ifadeleri bulur', () => {
    const profile = extractStyleFeatures(PETITION_1)
    expect(profile.stockPhrases.some((p) => p.phrase === 'yukarıda arz ve izah edilen nedenlerle')).toBe(
      true,
    )
  })

  it('kapanış kalıbını bulur', () => {
    const profile = extractStyleFeatures(PETITION_1)
    expect(profile.closings.some((p) => p.phrase === 'saygılarımla arz ederim')).toBe(true)
  })

  it('numaralandırma biçimini skeleton üzerinden sayar', () => {
    const profile = extractStyleFeatures(PETITION_1)
    expect(profile.numberingStyleCounts['arabic-dot']).toBe(2)
    expect(profile.numberingStyleCounts['roman-dot']).toBe(1)
  })

  it('terim tercihlerini sayar', () => {
    const profile = extractStyleFeatures(PETITION_1)
    expect(profile.preferredTerms.find((p) => p.phrase === 'davacı')?.count).toBe(1)
    expect(profile.preferredTerms.find((p) => p.phrase === 'ihtarname')?.count).toBe(1)
  })

  it('atıf biçimini şekle indirger (sayılar değil, kalıp)', () => {
    const profile = extractStyleFeatures(PETITION_2)
    expect(profile.citationPatterns).toHaveLength(1)
    expect(profile.citationPatterns[0]?.phrase).toContain('#')
    expect(profile.citationPatterns[0]?.phrase).not.toMatch(/\d/)
  })

  it('en çok 3 temsilî paragraf örnekler', () => {
    const profile = extractStyleFeatures(PETITION_1)
    expect(profile.sampleParagraphs.length).toBeLessThanOrEqual(3)
  })

  it('kişisel veri barındırmayan düz metinde de çökmez', () => {
    expect(() => extractStyleFeatures('Sözleşme feshedilmiştir.')).not.toThrow()
  })
})

describe('mergeStyleProfiles (M8.4)', () => {
  it('documentCount toplanır', () => {
    const merged = mergeStyleProfiles(extractStyleFeatures(PETITION_1), extractStyleFeatures(PETITION_2))
    expect(merged.documentCount).toBe(2)
  })

  it('sayaçlar (count/sum/max) sırayla DEĞİŞMEZ — birleştirme değişmeli (commutative)', () => {
    const a = extractStyleFeatures(PETITION_1)
    const b = extractStyleFeatures(PETITION_2)

    const ab = mergeStyleProfiles(a, b)
    const ba = mergeStyleProfiles(b, a)

    expect(ab.sentenceWordCounts.count).toBe(ba.sentenceWordCounts.count)
    expect(ab.sentenceWordCounts.sum).toBe(ba.sentenceWordCounts.sum)
    expect(ab.sentenceWordCounts.max).toBe(ba.sentenceWordCounts.max)
    expect(ab.paragraphSentenceCounts.count).toBe(ba.paragraphSentenceCounts.count)
    expect(ab.documentCount).toBe(ba.documentCount)
  })

  it('ifade frekansları toplanır, sıralama tutarlıdır', () => {
    const merged = mergeStyleProfiles(extractStyleFeatures(PETITION_1), extractStyleFeatures(PETITION_2))
    const closing = merged.closings.find((p) => p.phrase === 'saygılarımla arz ederim')
    expect(closing?.count).toBe(2)
    // "saygılarımla" alt-dizge olarak "saygılarımla arz ederim" içinde de eşleşir.
    const bareClosing = merged.closings.find((p) => p.phrase === 'saygılarımla')
    expect(bareClosing?.count).toBe(2)
  })

  it('numaralandırma sayaçları toplanır', () => {
    const merged = mergeStyleProfiles(extractStyleFeatures(PETITION_1), extractStyleFeatures(PETITION_2))
    expect(merged.numberingStyleCounts['arabic-dot']).toBe(4)
  })

  it('sample paragraflar birikir (en az iki belgeninki de temsil edilir)', () => {
    const merged = mergeStyleProfiles(extractStyleFeatures(PETITION_1), extractStyleFeatures(PETITION_2))
    expect(merged.sampleParagraphs.length).toBeGreaterThanOrEqual(2)
  })

  it('boş profille birleştirme kimlik (identity) gibi davranır', () => {
    const a = extractStyleFeatures(PETITION_1)
    const merged = mergeStyleProfiles(a, emptyStyleProfile())
    expect(merged.documentCount).toBe(a.documentCount)
    expect(merged.sentenceWordCounts.sum).toBe(a.sentenceWordCounts.sum)
  })
})

describe('buildStyleProfile — artımlı kurulum (M8.4)', () => {
  it('belge belge katlama, tek seferde çıkar+birleştir ile aynı toplamları verir', () => {
    const incremental = mergeStyleProfiles(emptyStyleProfile(), extractStyleFeatures(PETITION_1))
    const incrementalThenSecond = mergeStyleProfiles(incremental, extractStyleFeatures(PETITION_2))

    const built = buildStyleProfile([PETITION_1, PETITION_2])

    expect(built.documentCount).toBe(incrementalThenSecond.documentCount)
    expect(built.sentenceWordCounts.sum).toBe(incrementalThenSecond.sentenceWordCounts.sum)
    expect(built.sentenceWordCounts.count).toBe(incrementalThenSecond.sentenceWordCounts.count)
  })

  it('boş listede boş profil döner', () => {
    expect(buildStyleProfile([])).toEqual(emptyStyleProfile())
  })

  it('medyan sınırlı örnek havuzundan hesaplanır ve veri aralığı içinde kalır', () => {
    const profile = buildStyleProfile([PETITION_1, PETITION_2])
    const median = aggregateMedian(profile.sentenceWordCounts)
    expect(median).toBeGreaterThanOrEqual(0)
    expect(median).toBeLessThanOrEqual(profile.sentenceWordCounts.max)
  })
})
