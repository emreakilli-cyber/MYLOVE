import { describe, expect, it } from 'vitest'
import {
  aciliyet,
  dateToIsoDate,
  goreliZaman,
  gunFarki,
  hitap,
  isoDateToDate,
  kalanSureMetni,
  selamlama,
  tarihRozeti,
  uzunTarihEtiketi,
} from './tarih'

describe('gün aritmetiği', () => {
  it('ISO gün metnini yerel güne çevirir, kaydırmaz', () => {
    const d = isoDateToDate('2026-08-12')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(7) // Ağustos
    expect(d.getDate()).toBe(12)
  })

  it('gidiş dönüş kayıpsız', () => {
    expect(dateToIsoDate(isoDateToDate('2026-01-01'))).toBe('2026-01-01')
    expect(dateToIsoDate(isoDateToDate('2026-12-31'))).toBe('2026-12-31')
  })

  it('gün farkını doğru sayar', () => {
    expect(gunFarki('2026-08-12', '2026-08-10')).toBe(2)
    expect(gunFarki('2026-08-10', '2026-08-10')).toBe(0)
    expect(gunFarki('2026-08-08', '2026-08-10')).toBe(-2)
  })

  it('ay ve yıl sınırını aşar', () => {
    expect(gunFarki('2026-09-01', '2026-08-31')).toBe(1)
    expect(gunFarki('2027-01-01', '2026-12-31')).toBe(1)
  })

  it('yaz saati geçişinde gün kaybetmez', () => {
    // Avrupa'da saatler mart sonu ileri alınır. Saat bazlı çıkarma yapılsaydı
    // bu aralık 30 gün 23 saat çıkar ve yuvarlama hata verirdi.
    expect(gunFarki('2026-04-30', '2026-03-31')).toBe(30)
  })
})

describe('kalan süre metni', () => {
  it('bugün, yarın ve geçmiş için ayrı metin verir', () => {
    const bugun = dateToIsoDate(new Date())
    const artiGun = (n: number) =>
      dateToIsoDate(new Date(Date.now() + n * 86_400_000))

    expect(kalanSureMetni(bugun)).toBe('bugün son gün')
    expect(kalanSureMetni(artiGun(1))).toBe('yarın son gün')
    expect(kalanSureMetni(artiGun(5))).toBe('5 gün kaldı')
    expect(kalanSureMetni(artiGun(-1))).toBe('dün doldu')
    expect(kalanSureMetni(artiGun(-4))).toBe('4 gün geçti')
  })

  it('aciliyeti eşiklere göre ayırır', () => {
    const artiGun = (n: number) =>
      dateToIsoDate(new Date(Date.now() + n * 86_400_000))

    expect(aciliyet(artiGun(-1))).toBe('gecti')
    expect(aciliyet(artiGun(0))).toBe('kritik')
    expect(aciliyet(artiGun(2))).toBe('kritik')
    expect(aciliyet(artiGun(3))).toBe('yakin')
    expect(aciliyet(artiGun(7))).toBe('yakin')
    expect(aciliyet(artiGun(8))).toBe('normal')
  })
})

describe('Türkçe biçimlendirme', () => {
  it('büyük harfe çevirirken i harfini bozmaz', () => {
    // toUpperCase() "i" → "I" yapar; Türkçede doğrusu "İ".
    const etiket = uzunTarihEtiketi(new Date(2026, 0, 5)) // 5 Ocak 2026
    expect(etiket).toContain('OCAK')
    expect(etiket).not.toContain('I')
    expect(etiket).toContain('2026')
  })

  it('ay kısaltmasını Türkçe verir', () => {
    expect(tarihRozeti(new Date(2026, 7, 3)).ay).toBe('AĞU')
    expect(tarihRozeti(new Date(2026, 7, 3)).gun).toBe('03')
    expect(tarihRozeti(new Date(2026, 11, 25)).ay).toBe('ARA')
  })

  it('hitabı ilk addan kurar', () => {
    expect(hitap('Ayşe Kaya')).toBe('Av. Ayşe')
    expect(hitap('Mehmet Ali Şahin')).toBe('Av. Mehmet')
    expect(hitap('Elif')).toBe('Av. Elif')
  })

  it('selamlamayı saate göre seçer', () => {
    expect(selamlama(new Date(2026, 7, 3, 8))).toBe('Günaydın')
    expect(selamlama(new Date(2026, 7, 3, 13))).toBe('İyi günler')
    expect(selamlama(new Date(2026, 7, 3, 21))).toBe('İyi akşamlar')
  })
})

describe('göreli zaman', () => {
  const simdi = new Date(2026, 7, 4, 14, 0, 0)
  const oncesi = (dk: number) =>
    new Date(simdi.getTime() - dk * 60_000).toISOString()

  it('dakika ve saat eşiklerini ayırır', () => {
    expect(goreliZaman(oncesi(0), simdi)).toBe('az önce')
    expect(goreliZaman(oncesi(12), simdi)).toBe('12 dk önce')
    expect(goreliZaman(oncesi(59), simdi)).toBe('59 dk önce')
    expect(goreliZaman(oncesi(60), simdi)).toBe('1 saat önce')
    expect(goreliZaman(oncesi(180), simdi)).toBe('3 saat önce')
  })

  it('dünü saat ile gösterir', () => {
    const dun = new Date(2026, 7, 3, 16, 42, 0).toISOString()
    expect(goreliZaman(dun, simdi)).toBe('Dün, 16:42')
  })

  it('daha eskisini tarihle gösterir', () => {
    const eski = new Date(2026, 6, 28, 9, 15, 0).toISOString()
    expect(goreliZaman(eski, simdi)).toBe('28 Tem, 09:15')
  })
})
