import { tr } from 'date-fns/locale'
import { format } from 'date-fns'
import type { IsoDate, IsoDateTime } from './types'

/*
 * Türkçe tarih ve süre biçimlendirme.
 *
 * Büyük harfe çevirirken her yerde `toLocaleUpperCase('tr')` kullanılır:
 * varsayılan `toUpperCase()` "i" harfini "I" yapar, Türkçede doğrusu "İ".
 * "Nisan" → "NISAN" yanlış, "NİSAN" doğru.
 */

const GUN_MS = 86_400_000

/** Günün başlangıcı — gün farkı hesaplarında referans. */
export function gunBaslangici(kaynak: Date = new Date()): Date {
  const d = new Date(kaynak)
  d.setHours(0, 0, 0, 0)
  return d
}

/** "2026-08-12" → yerel saat diliminde o günün başlangıcı. */
export function isoDateToDate(gun: IsoDate): Date {
  // Sonuna saat eklemeden `new Date("2026-08-12")` UTC olarak yorumlanır ve
  // UTC+3'te bir gün geriye kayabilir. Yerel gün istiyoruz.
  return new Date(`${gun}T00:00:00`)
}

/** Date → "2026-08-12" */
export function dateToIsoDate(d: Date): IsoDate {
  const ay = String(d.getMonth() + 1).padStart(2, '0')
  const gun = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${ay}-${gun}`
}

export function bugunIso(): IsoDate {
  return dateToIsoDate(new Date())
}

/**
 * Bir tarih/zaman damgasını YEREL güne indirger. Saf "YYYY-MM-DD" değerler
 * (ör. `finans.tarih`, `sure.sonTarih`) olduğu gibi döner; UTC zaman damgaları
 * (`…Z`, ör. `olay.baslangic`, `gorev.tamamlanmaTarihi`) yerel güne çevrilir.
 *
 * Neden: olaylar UTC saklanıp arayüzde yerele çevriliyor; "hangi gün" kararı
 * (takvim kovası, "bugün", rapor aralığı) her yerde YEREL güne göre olmalı ki
 * gece yarısı civarındaki bir olay (ör. 22:00Z = UTC+3'te ertesi gün 01:00)
 * tüm ekranlarda aynı güne düşsün. Ham `slice(0, 10)` UTC gününü verir ve
 * yerel "bugün" ile karşılaştırıldığında sınırda bir gün kayması yaratır.
 */
export function yerelGun(zaman: IsoDate | IsoDateTime): IsoDate {
  return zaman.includes('T') ? dateToIsoDate(new Date(zaman)) : zaman.slice(0, 10)
}

/** Aradaki tam gün sayısı. Bugün → 0, yarın → 1, dün → -1. */
export function gunFarki(hedef: IsoDate, kaynak: IsoDate = bugunIso()): number {
  const a = isoDateToDate(hedef).getTime()
  const b = isoDateToDate(kaynak).getTime()
  return Math.round((a - b) / GUN_MS)
}

/* ------------------------------------------------------------------ *
 * Gösterim
 * ------------------------------------------------------------------ */

/** "PAZARTESİ, 3 AĞUSTOS 2026" — hero kartının üst etiketi. */
export function uzunTarihEtiketi(d: Date = new Date()): string {
  return format(d, 'EEEE, d MMMM yyyy', { locale: tr }).toLocaleUpperCase('tr')
}

/** "3 Ağustos" */
export function kisaTarih(gun: IsoDate): string {
  return format(isoDateToDate(gun), 'd MMMM', { locale: tr })
}

/** "3 Ağustos 2026" */
export function tamTarih(gun: IsoDate): string {
  return format(isoDateToDate(gun), 'd MMMM yyyy', { locale: tr })
}

/** Tarih rozeti: { gun: "03", ay: "AĞU" } */
export function tarihRozeti(zaman: IsoDateTime | Date): {
  gun: string
  ay: string
} {
  const d = typeof zaman === 'string' ? new Date(zaman) : zaman
  return {
    gun: format(d, 'dd', { locale: tr }),
    ay: format(d, 'MMM', { locale: tr }).toLocaleUpperCase('tr'),
  }
}

/** "09:30" */
export function saat(zaman: IsoDateTime | Date): string {
  const d = typeof zaman === 'string' ? new Date(zaman) : zaman
  return format(d, 'HH:mm')
}

/**
 * Son tarihe kalan süre: "2 gün kaldı", "bugün son gün", "3 gün geçti".
 * Hukuki sürede "bugün" ve "geçti" ayrımı kritik olduğu için ayrı metinler.
 */
export function kalanSureMetni(sonTarih: IsoDate): string {
  const fark = gunFarki(sonTarih)
  if (fark === 0) return 'bugün son gün'
  if (fark === 1) return 'yarın son gün'
  if (fark > 0) return `${fark} gün kaldı`
  if (fark === -1) return 'dün doldu'
  return `${Math.abs(fark)} gün geçti`
}

/** Aciliyet seviyesi — renk seçimi buna göre yapılır. */
export type Aciliyet = 'gecti' | 'kritik' | 'yakin' | 'normal'

export function aciliyet(sonTarih: IsoDate): Aciliyet {
  const fark = gunFarki(sonTarih)
  if (fark < 0) return 'gecti'
  if (fark <= 2) return 'kritik'
  if (fark <= 7) return 'yakin'
  return 'normal'
}

/**
 * Hareket akışındaki göreli zaman: "12 dk önce", "1 saat önce",
 * "Dün, 16:42", "28 Tem, 09:15".
 */
export function goreliZaman(zaman: IsoDateTime, simdi = new Date()): string {
  const d = new Date(zaman)
  const farkDk = Math.floor((simdi.getTime() - d.getTime()) / 60_000)

  if (farkDk < 1) return 'az önce'
  if (farkDk < 60) return `${farkDk} dk önce`

  const farkSaat = Math.floor(farkDk / 60)
  const bugun = gunBaslangici(simdi).getTime()
  const olayGunu = gunBaslangici(d).getTime()

  if (olayGunu === bugun) return `${farkSaat} saat önce`
  if (olayGunu === bugun - GUN_MS) return `Dün, ${saat(d)}`
  return format(d, 'd MMM, HH:mm', { locale: tr })
}

/** Saate göre selamlama. */
export function selamlama(d: Date = new Date()): string {
  const s = d.getHours()
  if (s < 12) return 'Günaydın'
  if (s < 18) return 'İyi günler'
  return 'İyi akşamlar'
}

/** "Ayşe Kaya" → "Av. Ayşe" */
export function hitap(tamAd: string): string {
  const ilkAd = tamAd.trim().split(/\s+/)[0] ?? tamAd
  return `Av. ${ilkAd}`
}

/** Bugünün ve önümüzdeki N günün ISO sınırları — aralık sorguları için. */
export function aralik(gunSayisi: number, baslangic: Date = new Date()) {
  const bas = gunBaslangici(baslangic)
  const son = new Date(bas.getTime() + gunSayisi * GUN_MS)
  return { bas, son, basIso: bas.toISOString(), sonIso: son.toISOString() }
}
