import { describe, expect, it } from 'vitest'
import { hazirlikHesapla, type HazirlikGirdisi } from './hazirlik'
import type {
  Belge,
  Dosya,
  DosyaTuru,
  FinansKaydi,
  Muvekkil,
  Olay,
  Sure,
} from './types'

/*
 * Hazırlık motoru dosya türüne duyarlıdır: icra takibinde duruşma, ceza
 * davasında harç, arabuluculukta mahkeme/esas no beklenmez. Uygulanmayan madde
 * yüzdeye hiç katılmamalı — aksi hâlde yüzde haksız düşer.
 */

const AN = '2026-08-05T00:00:00.000Z'

function dosyaYap(tur: DosyaTuru, ekstra: Partial<Dosya> = {}): Dosya {
  return {
    id: 'd1',
    olusturmaTarihi: AN,
    guncellemeTarihi: AN,
    baslik: 'Test / Dosya',
    muvekkilId: 'm1',
    tur,
    durum: 'derdest',
    esasNo: '2026/100',
    mahkeme: 'Ankara 1. Asliye Hukuk',
    acilisTarihi: '2026-01-01',
    arsivlendi: false,
    ...ekstra,
  }
}

const muvekkil: Muvekkil = {
  id: 'm1',
  olusturmaTarihi: AN,
  guncellemeTarihi: AN,
  ad: 'Test Müvekkil',
  tur: 'gercek',
  telefon: '5551112233',
  etiketler: [],
  arsivlendi: false,
}

function vekaletname(): Belge {
  return {
    id: 'b1',
    olusturmaTarihi: AN,
    guncellemeTarihi: AN,
    ad: 'vekaletname.pdf',
    tur: 'vekaletname',
    dosyaId: 'd1',
    mimeTur: 'application/pdf',
    boyut: 10,
    icerik: new Blob(['x']),
    etiketler: [],
  }
}

function durusma(): Olay {
  return {
    id: 'o1',
    olusturmaTarihi: AN,
    guncellemeTarihi: AN,
    baslik: 'Duruşma',
    tur: 'durusma',
    dosyaId: 'd1',
    baslangic: '2026-09-01T09:00:00.000Z',
    tumGun: false,
    durum: 'planlandi',
    kaynak: 'manuel',
  }
}

function odenmisHarc(): FinansKaydi {
  return {
    id: 'f1',
    olusturmaTarihi: AN,
    guncellemeTarihi: AN,
    dosyaId: 'd1',
    yon: 'gider',
    kategori: 'harc',
    baslik: 'Başvurma harcı',
    tutar: 50000,
    odenenTutar: 50000,
    tarih: '2026-01-02',
    odemeDurumu: 'odendi',
  }
}

function kacmisSure(): Sure {
  return {
    id: 's1',
    olusturmaTarihi: AN,
    guncellemeTarihi: AN,
    dosyaId: 'd1',
    kuralId: 'istinaf-hmk-345',
    kuralAdi: 'İstinaf süresi',
    kanunReferansi: 'HMK m. 345',
    baslangicTarihi: '2026-07-01',
    hamSonTarih: '2026-07-15',
    sonTarih: '2026-07-15',
    durum: 'kacirildi',
  }
}

/** Türün eksiksiz bir dosyası: uygulanan tüm maddeler tamamlanmış olmalı. */
function tamGirdi(tur: DosyaTuru): HazirlikGirdisi {
  return {
    dosya: dosyaYap(tur),
    muvekkil,
    olaylar: [durusma()],
    sureler: [],
    gorevler: [],
    finans: [odenmisHarc()],
    belgeler: [vekaletname()],
  }
}

const anahtarlar = (g: HazirlikGirdisi) =>
  hazirlikHesapla(g).maddeler.map((m) => m.anahtar)

describe('hazırlık — tür duyarlılığı', () => {
  it('icra takibinde duruşma ve gider avansı maddesi yok, etiketler icra diline döner', () => {
    const g = tamGirdi('icra')
    const ozet = hazirlikHesapla(g)
    const kler = ozet.maddeler.map((m) => m.anahtar)
    expect(kler).not.toContain('durusma')
    expect(kler).not.toContain('gider-avansi')
    expect(kler).toContain('harc')

    const mahkeme = ozet.maddeler.find((m) => m.anahtar === 'mahkeme')
    expect(mahkeme?.etiket).toBe('İcra dairesi girildi')
    const esas = ozet.maddeler.find((m) => m.anahtar === 'esas-no')
    expect(esas?.etiket).toBe('Takip numarası girildi')
  })

  it('ceza davasında harç ve gider avansı beklenmez', () => {
    const kler = anahtarlar(tamGirdi('ceza'))
    expect(kler).not.toContain('harc')
    expect(kler).not.toContain('gider-avansi')
    expect(kler).toContain('durusma')
  })

  it('arabuluculukta mahkeme, esas no, harç, duruşma ve gider avansı yok', () => {
    const kler = anahtarlar(tamGirdi('arabuluculuk'))
    for (const yok of ['mahkeme', 'esas-no', 'harc', 'durusma', 'gider-avansi']) {
      expect(kler).not.toContain(yok)
    }
    expect(kler).toContain('vekaletname')
  })

  it('tüketici davası harçtan muaftır: harç maddesi yok', () => {
    expect(anahtarlar(tamGirdi('tuketici'))).not.toContain('harc')
  })

  it('idari davada duruşma beklenmez (dosya üzerinden karar)', () => {
    expect(anahtarlar(tamGirdi('idari'))).not.toContain('durusma')
  })
})

describe('hazırlık — yüzde ve seviye', () => {
  it('her uygulanan madde tamamsa yüzde 100 ve seviye iyi', () => {
    for (const tur of ['hukuk', 'icra', 'ceza', 'arabuluculuk'] as DosyaTuru[]) {
      const ozet = hazirlikHesapla(tamGirdi(tur))
      expect(ozet.yuzde, tur).toBe(100)
      expect(ozet.seviye, tur).toBe('iyi')
    }
  })

  it('kaçmış süre en ağır madde: yüzdeyi düşürür ve sıradaki adımı belirler', () => {
    const g = tamGirdi('hukuk')
    g.sureler = [kacmisSure()]
    const ozet = hazirlikHesapla(g)
    expect(ozet.yuzde).toBeLessThan(100)
    expect(ozet.sonrakiAdim).toBe('Kaçırılan süreyi inceleyin')
  })

  it('olumsuz ("… yok") maddeler eksik olduğunda etiket gerçeğe döner', () => {
    // Bekleyen gider, kaçmış süre ve geciken görev ekle → üç madde de eksik.
    const g = tamGirdi('hukuk')
    g.finans = [
      odenmisHarc(),
      {
        id: 'f2',
        olusturmaTarihi: AN,
        guncellemeTarihi: AN,
        dosyaId: 'd1',
        yon: 'gider',
        kategori: 'diger',
        baslik: 'Bilirkişi ücreti',
        tutar: 300000,
        odenenTutar: 0,
        tarih: '2026-08-01',
        odemeDurumu: 'bekliyor',
      },
    ]
    g.sureler = [kacmisSure()]
    g.gorevler = [
      {
        id: 'g1',
        olusturmaTarihi: AN,
        guncellemeTarihi: AN,
        dosyaId: 'd1',
        baslik: 'Cevap dilekçesi yaz',
        durum: 'bekliyor',
        oncelik: 'normal',
        vadeTarihi: '2026-07-01',
      },
    ]
    const maddeler = hazirlikHesapla(g).maddeler
    const bul = (a: string) => maddeler.find((m) => m.anahtar === a)
    // Eksik olumsuz maddede gösterilecek etiket = etiketEksik (çift olumsuz olmaz)
    for (const [anahtar, eksik] of [
      ['odemeler', 'Bekleyen ödeme var'],
      ['sureler', 'Kaçırılmış süre var'],
      ['gorevler', 'Geciken görev var'],
    ] as const) {
      const m = bul(anahtar)
      expect(m?.tamam, anahtar).toBe(false)
      expect(m?.etiketEksik, anahtar).toBe(eksik)
    }
    // Olumlu maddede etiketEksik yok: tek etiket her durumda kullanılır.
    expect(bul('vekaletname')?.etiketEksik).toBeUndefined()
  })

  it('olumsuz maddeler tamamken de doğru olumlu etiketi taşır', () => {
    const maddeler = hazirlikHesapla(tamGirdi('hukuk')).maddeler
    const bul = (a: string) => maddeler.find((m) => m.anahtar === a)
    expect(bul('odemeler')?.tamam).toBe(true)
    expect(bul('odemeler')?.etiket).toBe('Bekleyen ödeme yok')
    expect(bul('sureler')?.etiket).toBe('Kaçırılmış süre yok')
    expect(bul('gorevler')?.etiket).toBe('Geciken görev yok')
  })

  it('icra takibi duruşmasız olduğu için duruşma eksikliğinden ceza almaz', () => {
    // Aynı boş veri: icra "duruşma yok" diye düşmezken hukuk düşer.
    const bos = (tur: DosyaTuru): HazirlikGirdisi => ({
      dosya: dosyaYap(tur),
      muvekkil,
      olaylar: [],
      sureler: [],
      gorevler: [],
      finans: [odenmisHarc()],
      belgeler: [vekaletname()],
    })
    const icra = hazirlikHesapla(bos('icra')).yuzde
    const hukuk = hazirlikHesapla(bos('hukuk')).yuzde
    expect(icra).toBeGreaterThan(hukuk)
  })
})
