import { describe, expect, it } from 'vitest'
import { dosyaAdiTemizle, icsUret } from './ics'
import type { Olay, Sure } from '../domain/types'

/*
 * ICS çıktısı takvim uygulamalarına aktarılacak; biçimin RFC 5545'e uygun
 * olması şart. Sabit bir `simdi` ile deterministik doğrulanır.
 */

describe('dosyaAdiTemizle — indirme dosya adını güvenli hâle getirir', () => {
  it('yol ayıracı ve güvensiz karakterleri tireye çevirir', () => {
    // Regresyon: "Yılmaz / Arslan" başlığındaki "/" download adında yolu
    // kesip dosyayı bozuyordu.
    expect(dosyaAdiTemizle('olay-yılmaz / arslan')).toBe('olay-yılmaz-arslan')
    expect(dosyaAdiTemizle('dava: 2026/123')).toBe('dava-2026-123')
    expect(dosyaAdiTemizle('a*b?c"d<e>f|g\\h')).toBe('a-b-c-d-e-f-g-h')
  })

  it('Türkçe harfleri korur, çoklu tireyi tekiller, baş/son tireyi kırpar', () => {
    expect(dosyaAdiTemizle('Şirket  İşleri')).toBe('Şirket-İşleri')
    expect(dosyaAdiTemizle('/// kenar ///')).toBe('kenar')
  })

  it('tümü güvensizse boş kalmaz (yedek ad)', () => {
    expect(dosyaAdiTemizle('///')).toBe('takvim')
  })
})

const SIMDI = new Date('2026-08-04T18:00:00Z')

function damga() {
  return { olusturmaTarihi: '2026-08-01T00:00:00Z', guncellemeTarihi: '2026-08-01T00:00:00Z' }
}

const zamanliOlay: Olay = {
  id: 'o1',
  baslik: 'Duruşma',
  tur: 'durusma',
  dosyaId: 'd1',
  baslangic: '2026-08-05T06:30:00.000Z', // 09:30 TR
  tumGun: false,
  yer: 'İstanbul 14. İş Mahkemesi',
  durum: 'planlandi',
  kaynak: 'manuel',
  ...damga(),
}

const tumGunOlay: Olay = {
  id: 'o2',
  baslik: 'Keşif',
  tur: 'kesif',
  baslangic: '2026-08-06T00:00:00.000Z',
  tumGun: true,
  durum: 'planlandi',
  kaynak: 'manuel',
  ...damga(),
}

const sure: Sure = {
  id: 's1',
  dosyaId: 'd1',
  kuralId: 'istinaf-hmk-345',
  kuralAdi: 'İstinaf başvuru süresi',
  kanunReferansi: 'HMK m. 345',
  baslangicTarihi: '2026-07-24',
  hamSonTarih: '2026-08-07',
  sonTarih: '2026-08-07',
  durum: 'acik',
  ...damga(),
}

function uret() {
  return icsUret({
    olaylar: [zamanliOlay, tumGunOlay],
    sureler: [sure],
    dosyaAdlari: new Map([['d1', 'Yılmaz / Arslan']]),
    simdi: SIMDI,
  })
}

describe('ICS üretimi', () => {
  it('geçerli VCALENDAR kabuğu üretir', () => {
    const ics = uret()
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics).toContain('VERSION:2.0')
    expect(ics).toContain('PRODID:-//JurisCalendar//TR//tr')
  })

  it('CRLF satır sonu kullanır', () => {
    expect(uret()).toContain('\r\n')
  })

  it('zamanlı olayı UTC damgayla yazar', () => {
    const ics = uret()
    expect(ics).toContain('DTSTART:20260805T063000Z')
    expect(ics).toContain('DTEND:20260805T073000Z') // varsayılan +1 saat
    expect(ics).toContain('SUMMARY:Duruşma — Yılmaz / Arslan')
    expect(ics).toContain('LOCATION:İstanbul 14. İş Mahkemesi')
  })

  it('tüm gün olayı VALUE=DATE ile yazar', () => {
    const ics = uret()
    expect(ics).toContain('DTSTART;VALUE=DATE:20260806')
    expect(ics).toContain('DTEND;VALUE=DATE:20260807') // ertesi gün
  })

  it('tüm gün olayı YEREL güne yazılır: UTC gün sınırını geçen başlangıç bir gün erken kaymaz', () => {
    // 2026-08-05T22:00:00Z = İstanbul'da (UTC+3) 6 Ağustos 01:00 → yerel gün
    // 6 Ağustos. Ham `baslangic.slice(0,10)` UTC gününü (5 Ağustos) verip olayı
    // takvim uygulamasında bir gün ERKEN gösterirdi; yerelGun bunu engeller.
    // (Testler vite.config `test.env.TZ` ile Europe/Istanbul'da koşar; bu sınır
    // yalnız hedef saat diliminde görünür.)
    const sinirdaTumGun: Olay = {
      ...tumGunOlay,
      id: 'o-sinir',
      baslangic: '2026-08-05T22:00:00.000Z',
    }
    const ics = icsUret({
      olaylar: [sinirdaTumGun],
      sureler: [],
      dosyaAdlari: new Map(),
      simdi: SIMDI,
    })
    expect(ics).toContain('DTSTART;VALUE=DATE:20260806')
    expect(ics).toContain('DTEND;VALUE=DATE:20260807')
    expect(ics).not.toContain('VALUE=DATE:20260805') // UTC gününe kaymamalı
  })

  it('hukuki süreyi tüm gün son-tarih olarak yazar', () => {
    const ics = uret()
    expect(ics).toContain('SUMMARY:Son gün: İstinaf başvuru süresi — Yılmaz / Arslan')
    expect(ics).toContain('DTSTART;VALUE=DATE:20260807')
    expect(ics).toContain('HMK m. 345')
  })

  it('her kayıt için benzersiz UID verir', () => {
    const ics = uret()
    expect(ics).toContain('UID:olay-o1@juriscalendar')
    expect(ics).toContain('UID:olay-o2@juriscalendar')
    expect(ics).toContain('UID:sure-s1@juriscalendar')
  })

  it('özel karakterleri kaçışlar', () => {
    const virgullu: Olay = {
      ...tumGunOlay,
      id: 'o3',
      baslik: 'Görüşme; acil, önemli',
    }
    const ics = icsUret({
      olaylar: [virgullu],
      sureler: [],
      dosyaAdlari: new Map(),
      simdi: SIMDI,
    })
    expect(ics).toContain('SUMMARY:Görüşme\\; acil\\, önemli')
  })

  it('iptal olayları atlar', () => {
    const iptal: Olay = { ...zamanliOlay, id: 'o4', durum: 'iptal' }
    const ics = icsUret({
      olaylar: [iptal],
      sureler: [],
      dosyaAdlari: new Map(),
      simdi: SIMDI,
    })
    expect(ics).not.toContain('UID:olay-o4')
  })

  it('uzun Türkçe satırı 75 OKTET sınırında katlar, çok baytlı harfi bölmez', () => {
    // Türkçe harfler UTF-8'de 2 bayt; kod-birimi (`.length`) sayan eski katlama
    // uzun Türkçe SUMMARY satırını eşiğin altında görüp katlamıyordu (>75 oktet).
    const uzunAd =
      'Şişecam İşçi Şirketi ve Çağrı Müdürlüğü Güçlü İnşaat Ünlü Öztürk Çelik Ağır Sanayi'
    const ics = icsUret({
      olaylar: [{ ...tumGunOlay, id: 'o5', dosyaId: 'dLong' }],
      sureler: [],
      dosyaAdlari: new Map([['dLong', uzunAd]]),
      simdi: SIMDI,
    })
    const enc = new TextEncoder()
    const satirlar = ics.split('\r\n')
    // Her fiziksel satır ≤75 oktet (CRLF hariç).
    for (const s of satirlar) {
      expect(enc.encode(s).length).toBeLessThanOrEqual(75)
    }
    // En az bir satır katlanmış (devam satırı tek boşlukla başlar).
    expect(satirlar.some((s) => s.startsWith(' '))).toBe(true)
    // Katlama açıldığında özgün Türkçe ad bozulmadan geri gelir (harf bölünmedi).
    const acilmis = ics.replace(/\r\n /g, '')
    expect(acilmis).toContain(uzunAd)
  })
})
