import { describe, expect, it } from 'vitest'
import { turkceKarsilastir } from './metin'

/*
 * Türkçe alfabetik sıralama. Müvekkil ve dosya listeleri buna dayanır. Klasik
 * hata: `localeCompare` çağrısında 'tr' argümanını unutmak — o zaman Türk
 * alfabesi yanlış sıralanır ("ı" "i"den önce, "ç"/"ş" "c"/"s"den sonra gelmez).
 */

describe('turkceKarsilastir', () => {
  it('"ı", "i"den önce gelir (Türk alfabesi I/İ ayrı harf)', () => {
    // Düz localeCompare (argümansız) burada TERS (pozitif) döner.
    expect(turkceKarsilastir('ışık', 'iyi')).toBeLessThan(0)
  })

  it('"ç", "c"den sonra gelir', () => {
    expect(turkceKarsilastir('cengiz', 'çelik')).toBeLessThan(0)
  })

  it('"ş", "s"den sonra gelir', () => {
    expect(turkceKarsilastir('sahin', 'şahin')).toBeLessThan(0)
  })

  it('bir listeyi doğru Türkçe sıraya dizer', () => {
    const adlar = ['Zorlu', 'Çelik', 'Işık', 'İzmir', 'Sahin', 'Şahin', 'Cengiz']
    expect([...adlar].sort(turkceKarsilastir)).toEqual([
      'Cengiz',
      'Çelik',
      'Işık',
      'İzmir',
      'Sahin',
      'Şahin',
      'Zorlu',
    ])
  })

  it('eşit metinlerde 0 döner', () => {
    expect(turkceKarsilastir('Demir İnşaat', 'Demir İnşaat')).toBe(0)
  })
})
