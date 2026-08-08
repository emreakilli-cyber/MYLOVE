import { describe, expect, it } from 'vitest'
import { nameKey, splitAtApostrophe, splitName, stripKnownSuffix } from './suffix'

describe('kesme işaretli ek ayırma (M4.1)', () => {
  it('yaygın hâl eklerini ayırır', () => {
    for (const [word, root, suffix] of [
      ["Ahmet'in", 'Ahmet', "'in"],
      ["Ahmet'e", 'Ahmet', "'e"],
      ["Ahmet'ten", 'Ahmet', "'ten"],
      ["Ahmet'le", 'Ahmet', "'le"],
      ["Ahmet'i", 'Ahmet', "'i"],
    ] as const) {
      expect(splitAtApostrophe(word)).toEqual({ root, suffix })
    }
  })

  it('tipografik kesme işaretini de tanır', () => {
    expect(splitAtApostrophe('Ahmet’in')).toEqual({ root: 'Ahmet', suffix: '’in' })
  })

  it('kesme başta veya sonda ise ek saymaz', () => {
    expect(splitAtApostrophe("'Ahmet")).toBeUndefined()
    expect(splitAtApostrophe("Ahmet'")).toBeUndefined()
  })

  it('kurum adındaki eki ayırır (M4.5)', () => {
    expect(splitAtApostrophe("Egeperla AVM'nin")).toEqual({
      root: 'Egeperla AVM',
      suffix: "'nin",
    })
  })
})

describe('ünsüz yumuşaması ve anahtar üretimi (M4.3)', () => {
  it('yumuşamış ve sert yazımı aynı anahtara indirger', () => {
    expect(nameKey('Ahmet')).toBe(nameKey('Ahmed'))
    expect(nameKey('Mehmet')).toBe(nameKey('Mehmed'))
  })

  it('Türkçe büyütme kuralını uygular', () => {
    expect(nameKey('ışıl')).toBe('IŞIL')
    expect(nameKey('irem')).toBe('İREM')
  })

  it('yumuşamaya konu olmayan sonu değiştirmez', () => {
    expect(nameKey('Yılmaz')).toBe('YILMAZ')
  })
})

describe('kesme işaretsiz ek soyma (M4.2)', () => {
  const known = (candidate: string): boolean =>
    ['AHMET', 'YILMAZ'].includes(candidate)

  it('kök bilinen adlar arasındaysa soyar', () => {
    expect(stripKnownSuffix('Ahmetin', known)).toEqual({ root: 'Ahmet', suffix: 'in' })
    expect(stripKnownSuffix('Ahmete', known)).toEqual({ root: 'Ahmet', suffix: 'e' })
  })

  it('kök bilinmiyorsa sıradan sözcüğü parçalamaz', () => {
    expect(stripKnownSuffix('Mahkemede', known)).toBeUndefined()
    expect(stripKnownSuffix('duruşmada', known)).toBeUndefined()
  })

  it('splitName kesme yoksa ve kök bilinmiyorsa sözcüğü olduğu gibi bırakır', () => {
    expect(splitName('Mahkemede')).toEqual({ root: 'Mahkemede', suffix: '' })
  })
})
