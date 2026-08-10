import { describe, expect, it } from 'vitest'
import { YEDEK_SURUMU, sifreliMi, yedekOzeti, type Yedek } from './yedek'

/*
 * Yedekleme, local-first uygulamada verinin tek güvencesi; bu iki saf yardımcı
 * geri yükleme akışının kritik kararlarını sürüyor:
 *  - sifreliMi: dosya şifreli mi? → parola sorulup sorulmayacağını belirler.
 *  - yedekOzeti: kullanıcı geri yüklemeden ÖNCE neyin üzerine yazılacağını görür.
 * Yanlış sonuç → ya parola ekranı atlanır ya da kullanıcı yanlış sayıya güvenir.
 */

describe('sifreliMi', () => {
  it('şifreli zarfı tanır', () => {
    const zarf = JSON.stringify({
      bicim: 'juriscalendar-sifreli-yedek',
      surum: 1,
      tuz: 'AA==',
      iv: 'BB==',
      veri: 'CC==',
    })
    expect(sifreliMi(zarf)).toBe(true)
  })

  it('düz (şifresiz) yedeği şifreli saymaz', () => {
    const duz = JSON.stringify({ bicim: 'juriscalendar-yedek', surum: 1 })
    expect(sifreliMi(duz)).toBe(false)
  })

  it('geçersiz JSON veya alakasız içerikte false döner (çökme yok)', () => {
    expect(sifreliMi('bu json değil {{{')).toBe(false)
    expect(sifreliMi('')).toBe(false)
    expect(sifreliMi(JSON.stringify({ baska: 'nesne' }))).toBe(false)
  })
})

// yedekOzeti yalnızca dizilerin uzunluğunu okur; test için o uzunlukta
// yer tutucu diziler yeterli (kontrollü cast).
function sahteListe<T>(adet: number): T[] {
  return Array.from({ length: adet }) as T[]
}

function yedekKur(sayilar: Partial<Record<string, number>>): Yedek {
  return {
    bicim: 'juriscalendar-yedek',
    surum: YEDEK_SURUMU,
    olusturmaZamani: '2026-08-10T00:00:00.000Z',
    tablolar: {
      kullanicilar: sahteListe(sayilar.kullanicilar ?? 0),
      muvekkiller: sahteListe(sayilar.muvekkiller ?? 0),
      dosyalar: sahteListe(sayilar.dosyalar ?? 0),
      olaylar: sahteListe(sayilar.olaylar ?? 0),
      sureler: sahteListe(sayilar.sureler ?? 0),
      gorevler: sahteListe(sayilar.gorevler ?? 0),
      finans: sahteListe(sayilar.finans ?? 0),
      belgeler: sahteListe(sayilar.belgeler ?? 0),
      kisiler: sahteListe(sayilar.kisiler ?? 0),
      notlar: sahteListe(sayilar.notlar ?? 0),
      hatirlatmalar: sahteListe(sayilar.hatirlatmalar ?? 0),
      hareketler: sahteListe(sayilar.hareketler ?? 0),
      ayarlar: sahteListe(sayilar.ayarlar ?? 0),
    },
  }
}

describe('yedekOzeti', () => {
  it('kullanıcıya gösterilen yedi tablonun sayısını doğru verir', () => {
    const ozet = yedekOzeti(
      yedekKur({
        dosyalar: 24,
        muvekkiller: 18,
        olaylar: 8,
        sureler: 5,
        gorevler: 17,
        finans: 12,
        belgeler: 3,
      }),
    )
    expect(ozet).toEqual([
      ['Dosya', 24],
      ['Müvekkil', 18],
      ['Takvim olayı', 8],
      ['Süre', 5],
      ['Görev', 17],
      ['Finans kaydı', 12],
      ['Belge', 3],
    ])
  })

  it('boş yedekte tüm sayılar sıfırdır', () => {
    for (const [, sayi] of yedekOzeti(yedekKur({}))) {
      expect(sayi).toBe(0)
    }
  })

  it('tablo dizisi eksik olsa bile 0 döndürür (bozuk/eski dosyaya dayanıklı)', () => {
    const eksik = { tablolar: {} } as unknown as Yedek
    for (const [, sayi] of yedekOzeti(eksik)) {
      expect(sayi).toBe(0)
    }
  })
})
