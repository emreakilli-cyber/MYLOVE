import { describe, expect, it } from 'vitest'
import { unmask } from './mask'
import { createDictionaryNerBackend } from './ner'
import { MaskReview, MaskReviewError } from './review'

const ner = createDictionaryNerBackend({ people: ['Ahmet Yılmaz'] })

describe('maske listesi (M6.1)', () => {
  it('token, tip, kök, geçiş sayısı, konum ve güven döndürür', () => {
    const review = new MaskReview('Tel 0532 111 22 33, yine 0532 111 22 33')
    const masks = review.listMasks()

    expect(masks).toHaveLength(1)
    expect(masks[0]).toMatchObject({
      token: '[TEL_1]',
      type: 'TEL',
      occurrenceCount: 2,
      layer: 'rule',
    })
    expect(masks[0]?.confidence).toBeGreaterThan(0)
  })
})

describe('elle maske ekleme (M6.2)', () => {
  it('seçili aralığı maskeler', () => {
    const review = new MaskReview('Tanık Zeynep Kara ifade verdi.')
    const start = review.sourceText.indexOf('Zeynep Kara')
    const token = review.addMask({ start, end: start + 'Zeynep Kara'.length }, 'KISI')

    expect(token).toBe('[KISI_1]')
    expect(review.maskedText).toBe('Tanık [KISI_1] ifade verdi.')
  })

  it('geçersiz aralığı reddeder', () => {
    const review = new MaskReview('kısa metin')
    expect(() => review.addMask({ start: 5, end: 5 }, 'KISI')).toThrow(MaskReviewError)
    expect(() => review.addMask({ start: 0, end: 999 }, 'KISI')).toThrow(MaskReviewError)
  })
})

describe('mevcut maskeye bağlama (M6.3)', () => {
  it('ikinci aralığı aynı token’a düşürür', () => {
    const review = new MaskReview('Ahmet Yılmaz geldi. Müvekkil de aynı kişidir.', { ner })
    const start = review.sourceText.indexOf('Müvekkil')
    review.linkToExisting({ start, end: start + 'Müvekkil'.length }, '[KISI_1]')

    expect(review.maskedText).toBe('[KISI_1] geldi. [KISI_1] de aynı kişidir.')
    expect(review.table.size).toBe(1)
  })

  it('bilinmeyen token’ı reddeder', () => {
    const review = new MaskReview('metin')
    expect(() => review.linkToExisting({ start: 0, end: 5 }, '[KISI_9]')).toThrow(
      MaskReviewError,
    )
  })
})

describe('maske kaldırma (M6.4)', () => {
  it('kaldırılan maske metne geri döner', () => {
    const review = new MaskReview('Tel 0532 111 22 33 ve TC 10000000146')
    expect(review.maskedText).toBe('Tel [TEL_1] ve TC [TCKN_1]')

    review.removeMask('[TEL_1]')
    expect(review.maskedText).toBe('Tel 0532 111 22 33 ve TC [TCKN_1]')
  })

  it('kaldırma sonrası numaralandırma tutarlı kalır (M6.6)', () => {
    const review = new MaskReview('0532 111 22 33 ve 0533 222 33 44 ve 0534 333 44 55')
    review.removeMask('[TEL_1]')

    expect(review.maskedText).toBe('0532 111 22 33 ve [TEL_1] ve [TEL_2]')
    expect(unmask(review.maskedText, review.table).text).toBe(
      '0532 111 22 33 ve 0533 222 33 44 ve 0534 333 44 55',
    )
  })
})

describe('tümüne uygula (M6.5)', () => {
  it('çekim ekli biçimler dâhil bütün geçişleri bağlar', () => {
    const text = "Zeynep geldi, Zeynep'in beyanı alındı, Zeynep'e tebliğ edildi."
    const review = new MaskReview(text)
    const start = review.sourceText.indexOf('Zeynep')

    review.applyToAll({ start, end: start + 'Zeynep'.length }, 'KISI')

    expect(review.maskedText).toBe(
      "[KISI_1] geldi, [KISI_1]'in beyanı alındı, [KISI_1]'e tebliğ edildi.",
    )
    expect(review.table.size).toBe(1)
    expect(unmask(review.maskedText, review.table).text).toBe(text)
  })
})

describe('her işlemden sonra birebirlik korunur (M6.6)', () => {
  it('ekle → bağla → kaldır dizisinde unmask bozulmaz', () => {
    const text = 'Ahmet Yılmaz, tel 0532 111 22 33, tanık Zeynep Kara.'
    const review = new MaskReview(text, { ner })

    const zeynep = review.sourceText.indexOf('Zeynep Kara')
    review.addMask({ start: zeynep, end: zeynep + 'Zeynep Kara'.length }, 'KISI')
    expect(unmask(review.maskedText, review.table).text).toBe(text)

    review.removeMask('[TEL_1]')
    expect(unmask(review.maskedText, review.table).text).toBe(text)

    const tel = review.sourceText.indexOf('0532')
    review.addMask({ start: tel, end: tel + '0532 111 22 33'.length }, 'TEL')
    expect(unmask(review.maskedText, review.table).text).toBe(text)
  })
})

describe('API saf veridir (M6.7)', () => {
  it('döndürülen kayıtlar düz nesnedir, arayüz taşımaz', () => {
    const review = new MaskReview('TC 10000000146')
    const mask0 = review.listMasks()[0]

    expect(mask0).toBeDefined()
    expect(Object.getPrototypeOf(mask0)).toBe(Object.prototype)
  })
})
