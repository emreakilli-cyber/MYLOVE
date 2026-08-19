import { describe, expect, it } from 'vitest'
import {
  addDocumentToProfile,
  buildStyleProfile,
  emptyStyleProfile,
  mergeStyleProfiles,
} from './styleProfile'

const PETITION_1 = `
Sayın Mahkemenize saygıyla arz ederim. Bu kısa cümle.

Müvekkilimiz ile davalı arasındaki sözleşmeden doğan yükümlülükler yerine
getirilmemiştir. Bu durum
TBK m. 112 kapsamında değerlendirilmelidir. Ayrıca Yargıtay 3. Hukuk Dairesi
2021/456 K. sayılı kararında benzer bir olayda davacı lehine karar vermiştir.

Yukarıda arz ve izah edilen nedenlerle saygılarımla arz ve talep ederim.
`

const PETITION_2 = `
Sayın Mahkemenize saygıyla arz ederim. Kısa bir cümle daha.

Davalı kiracı, kira bedelini ödememiştir. TBK m. 315 gereği tahliye şartları
oluşmuştur.

Yukarıda arz ve izah edilen nedenlerle saygılarımla arz ve talep ederim.
`

describe('buildStyleProfile (M8.3)', () => {
  it('cümle ve paragraf uzunluğu dağılımını hesaplar', () => {
    const profile = buildStyleProfile(PETITION_1)
    expect(profile.documentCount).toBe(1)
    expect(profile.sentenceLength.count).toBeGreaterThan(0)
    expect(profile.paragraphLength.count).toBe(3)
  })

  it('açılış ve kapanış cümlesini yakalar', () => {
    const profile = buildStyleProfile(PETITION_1)
    expect(Object.keys(profile.openingPhrases)[0]).toContain('sayın mahkemenize saygıyla arz ederim')
    expect(Object.keys(profile.closingPhrases)[0]).toContain('saygılarımla arz ve talep ederim')
  })

  it('atıf biçimini tanır: kanun maddesi, yargıtay dairesi, esas/karar no', () => {
    const profile = buildStyleProfile(PETITION_1)
    expect(profile.citationPatterns.kanun_maddesi).toBe(1)
    expect(profile.citationPatterns.yargitay_dairesi).toBe(1)
    expect(profile.citationPatterns.esas_karar_no).toBe(1)
  })

  it('terim tercihini sayar', () => {
    const profile = buildStyleProfile(PETITION_1)
    expect(profile.termPreferences['müvekkilimiz']).toBeGreaterThan(0)
    expect(profile.termPreferences['sayın mahkemenize']).toBeGreaterThan(0)
  })

  it('belge içi tekrar eden kalıp ifadeyi kalıp olarak işaretler', () => {
    const repeated =
      'sözleşmeden doğan tazminat talebi sözleşmeden doğan tazminat talebi başka metin ' +
      'sözleşmeden doğan tazminat talebi'
    const profile = buildStyleProfile(repeated)
    expect(profile.stockPhrases['sözleşmeden doğan tazminat talebi']).toBe(3)
  })

  it('tekrar etmeyen 4 kelimelik dizge kalıp sayılmaz', () => {
    const profile = buildStyleProfile('bir defa geçen dizge burada biter')
    expect(Object.keys(profile.stockPhrases)).toHaveLength(0)
  })

  it('numaralandırma biçimi verilirse frekans haritasına yazılır', () => {
    const profile = buildStyleProfile(PETITION_1, 'arabic')
    expect(profile.numberingStyle).toEqual({ arabic: 1 })
  })

  it('boş metinde çökmez', () => {
    const profile = buildStyleProfile('')
    expect(profile.documentCount).toBe(1)
    expect(profile.sentenceLength.count).toBe(0)
    expect(profile.openingPhrases).toEqual({})
  })
})

describe('mergeStyleProfiles / addDocumentToProfile (M8.4 — artımlı birleştirme)', () => {
  it('boştan başlayıp belge belge eklemek, hepsini birden birleştirmekle AYNI sonucu verir', () => {
    const incremental = addDocumentToProfile(
      addDocumentToProfile(emptyStyleProfile(), PETITION_1, 'arabic'),
      PETITION_2,
      'arabic',
    )

    const batch = mergeStyleProfiles(buildStyleProfile(PETITION_1, 'arabic'), buildStyleProfile(PETITION_2, 'arabic'))

    expect(incremental).toEqual(batch)
  })

  it('değişmeli: a+b === b+a', () => {
    const p1 = buildStyleProfile(PETITION_1)
    const p2 = buildStyleProfile(PETITION_2)
    expect(mergeStyleProfiles(p1, p2)).toEqual(mergeStyleProfiles(p2, p1))
  })

  it('documentCount ve histogram sayaçları toplanır', () => {
    const merged = mergeStyleProfiles(buildStyleProfile(PETITION_1), buildStyleProfile(PETITION_2))
    expect(merged.documentCount).toBe(2)
    expect(merged.paragraphLength.count).toBe(6)
  })

  it('ortak açılış cümlesi iki belgede de kullanılınca frekansı 2 olur', () => {
    const merged = mergeStyleProfiles(buildStyleProfile(PETITION_1), buildStyleProfile(PETITION_2))
    const opening = Object.entries(merged.openingPhrases).find(([key]) =>
      key.includes('sayın mahkemenize saygıyla arz ederim'),
    )
    expect(opening?.[1]).toBe(2)
  })

  it('atıf ve terim frekansları belgeler arası toplanır', () => {
    const merged = mergeStyleProfiles(buildStyleProfile(PETITION_1), buildStyleProfile(PETITION_2))
    expect(merged.citationPatterns.kanun_maddesi).toBe(2)
    expect(merged.termPreferences['sayın mahkemenize']).toBe(2)
  })
})
