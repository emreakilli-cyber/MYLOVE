import { describe, expect, it } from 'vitest'
import {
  YEDEK_SURUMU,
  YEDEK_TABLOLARI,
  YedekHatasi,
  dogrula,
  sifreliMi,
  yedekOzeti,
  type Yedek,
} from './yedek'
import { db } from './db'

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

describe('dogrula — geri yükleme öncesi yedek doğrulaması', () => {
  it('geçerli yedeği kabul eder (fırlatmaz)', () => {
    expect(() => dogrula(yedekKur({ dosyalar: 3 }))).not.toThrow()
  })

  it('nesne olmayan girdiyi reddeder', () => {
    expect(() => dogrula(null)).toThrow(YedekHatasi)
    expect(() => dogrula('metin')).toThrow(YedekHatasi)
  })

  it('yanlış biçim etiketini reddeder', () => {
    expect(() => dogrula({ bicim: 'baska', surum: 1, tablolar: {} })).toThrow(
      /JurisCalendar yedeği değil/,
    )
  })

  it('uygulamadan yeni sürümü reddeder', () => {
    expect(() =>
      dogrula({ bicim: 'juriscalendar-yedek', surum: YEDEK_SURUMU + 1, tablolar: {} }),
    ).toThrow(/daha yeni/)
  })

  it('tablolar nesne değilse reddeder', () => {
    expect(() =>
      dogrula({ bicim: 'juriscalendar-yedek', surum: 1, tablolar: 42 }),
    ).toThrow(/içeriği eksik/)
  })

  it('bir tablo alanı dizi değilse "bozuk" olarak reddeder — DB clear/rollback\'e kalmasın', () => {
    // Regresyon: elle bozulmuş dosya (dosyalar bir metin) geri yükleme
    // tabloları temizlemeden ÖNCE, net bir mesajla reddedilmeli.
    expect(() =>
      dogrula({
        bicim: 'juriscalendar-yedek',
        surum: 1,
        tablolar: { dosyalar: 'boom' },
      }),
    ).toThrow(/içeriği bozuk/)
    expect(() =>
      dogrula({
        bicim: 'juriscalendar-yedek',
        surum: 1,
        tablolar: { belgeler: 5 },
      }),
    ).toThrow(/içeriği bozuk/)
  })
})

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

describe('yedek kapsamı — şema/yedek kayması koruması', () => {
  /*
   * Local-first uygulamada yedek, verinin tek güvencesi. Geri yükleme önce TÜM
   * `db.tables`'ı `clear()` edip sonra YEDEK_TABLOLARI'nı yeniden yazar; şemaya
   * eklenip yedeğe eklenmeyen bir tablo geri yüklemede sessizce SİLİNİR. Bu
   * test, YEDEK_TABLOLARI'nın şemadaki tüm tablolarla birebir eşleşmesini
   * zorlar — şema büyüyünce (yedek güncellenmezse) kırmızıya döner.
   */
  it('YEDEK_TABLOLARI, şemadaki tüm db.tables ile birebir eşleşir', () => {
    const semaTablolari = db.tables.map((t) => t.name).sort()
    expect([...YEDEK_TABLOLARI].sort()).toEqual(semaTablolari)
  })
})
