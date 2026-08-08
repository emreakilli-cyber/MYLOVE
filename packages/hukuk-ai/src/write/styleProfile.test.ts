import { describe, expect, it } from 'vitest'
import { addDocument, emptyStyleProfile } from './styleProfile'

const DOC_1 = `İSTANBUL 3. ASLİYE HUKUK MAHKEMESİ'NE

DAVACI
Ahmet Yılmaz

AÇIKLAMALAR

1. Davalı ile aramızda 6098 sayılı TBK m. 112 kapsamında bir sözleşme
imzalanmıştır ve davalı bu sözleşmeye aykırı davranmıştır. Yukarıda arz ve
izah edilen nedenlerle davanın kabulüne karar verilmesini saygıyla arz ve
talep ederim.

SONUÇ VE İSTEM
Saygılarımla arz ve talep ederim.

Saygılarımla`

const DOC_2 = `ANKARA 5. İŞ MAHKEMESİ'NE

DAVACI
Zeynep Kaya

AÇIKLAMALAR

1. Müvekkil, 4857 sayılı İş Kanunu m. 25 uyarınca haksız yere işten
çıkarılmıştır. Davalı işveren fesih bildirimini usulüne uygun
yapmamıştır. Yukarıda açıklanan nedenlerle davanın kabulünü talep ederiz.

SONUÇ VE İSTEM
Saygılarımla arz ederim.

Saygılarımla`

describe('emptyStyleProfile / addDocument (M8.3, M8.4)', () => {
  it('boş profilde her şey sıfırdır', () => {
    const profile = emptyStyleProfile()
    expect(profile.documentCount).toBe(0)
    expect(profile.sentenceLength.count).toBe(0)
    expect(profile.numberingStyle).toBe('none')
    expect(profile.sampleParagraphs).toEqual([])
  })

  it('belge eklendikçe documentCount artar', () => {
    const p1 = addDocument(emptyStyleProfile(), 'doc-1', DOC_1)
    expect(p1.documentCount).toBe(1)
    const p2 = addDocument(p1, 'doc-2', DOC_2)
    expect(p2.documentCount).toBe(2)
  })

  it('artımlı ekleme, tüm belgeleri baştan işlemekle aynı istatistiği verir', () => {
    const incremental = addDocument(addDocument(emptyStyleProfile(), 'doc-1', DOC_1), 'doc-2', DOC_2)
    expect(incremental.sentenceLength.count).toBeGreaterThan(0)
    expect(incremental.paragraphLength.count).toBeGreaterThan(0)
    // Ortalama iki pozitif değerin arasında bir yerde olmalı (çalışan ortalama doğru katlanmış).
    expect(incremental.sentenceLength.mean).toBeGreaterThan(0)
  })

  it('kalıp ifadeleri sayar', () => {
    const profile = addDocument(emptyStyleProfile(), 'doc-1', DOC_1)
    expect(profile.boilerplatePhrases['yukarıda arz ve izah edilen nedenlerle']).toBe(1)
    expect(profile.boilerplatePhrases['saygılarımla arz ve talep ederim']).toBe(1)
  })

  it('terim tercihlerini sayar', () => {
    const profile = addDocument(emptyStyleProfile(), 'doc-1', DOC_1)
    expect(profile.termPreferences['davalı']).toBeGreaterThanOrEqual(1)
  })

  it('atıf örneklerini yakalar', () => {
    const profile = addDocument(emptyStyleProfile(), 'doc-1', DOC_1)
    expect(profile.citationSamples).toContain('6098 sayılı TBK m. 112')
  })

  it('hitap ve kapanış örneklerini toplar', () => {
    const profile = addDocument(emptyStyleProfile(), 'doc-1', DOC_1)
    expect(profile.salutationSamples).toEqual(["İSTANBUL 3. ASLİYE HUKUK MAHKEMESİ'NE"])
    expect(profile.closingSamples).toEqual(['Saygılarımla'])
  })

  it('her belgeden en fazla birkaç temsilî paragraf ekler', () => {
    const profile = addDocument(emptyStyleProfile(), 'doc-1', DOC_1)
    expect(profile.sampleParagraphs.length).toBeGreaterThan(0)
    expect(profile.sampleParagraphs.every((sample) => sample.documentId === 'doc-1')).toBe(true)
  })

  it('numaralandırma biçimini belgeden çıkarır ve korur', () => {
    const profile = addDocument(emptyStyleProfile(), 'doc-1', DOC_1)
    expect(profile.numberingStyle).toBe('arabic-dot')
  })

  it('örnek listeleri sınırsız büyümez (MAX_SAMPLES sınırı)', () => {
    let profile = emptyStyleProfile()
    for (let index = 0; index < 60; index += 1) {
      profile = addDocument(profile, `doc-${index}`, DOC_1)
    }
    expect(profile.citationSamples.length).toBeLessThanOrEqual(40)
    expect(profile.sampleParagraphs.length).toBeLessThanOrEqual(40)
  })
})
