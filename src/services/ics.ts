import type { Olay, Sure } from '../domain/types'
import { olayGorunumleri } from '../domain/olay'
import { yerelGun } from '../domain/tarih'

/*
 * iCalendar (RFC 5545) dışa aktarma. Takvimi Google / Apple / Outlook'a
 * aktarmak sunucu gerektirmez: standart bir .ics dosyası üretip kullanıcıya
 * indirtiyoruz, o da takvim uygulamasına içe aktarıyor.
 *
 * Abone olunabilir (webcal) canlı akış bir sunucu ister; onu rehber ekranında
 * açıklıyoruz, dosya dışa aktarma ise burada.
 */

/** RFC 5545 metin kaçışı: ters bölü, virgül, noktalı virgül, satır sonu. */
function metinKacis(deger: string): string {
  return deger
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** 75 oktetlik satır katlaması (devam satırları bir boşlukla başlar). */
function satirKatla(satir: string): string {
  if (satir.length <= 75) return satir
  const parcalar: string[] = []
  let kalan = satir
  parcalar.push(kalan.slice(0, 75))
  kalan = kalan.slice(75)
  while (kalan.length > 74) {
    parcalar.push(' ' + kalan.slice(0, 74))
    kalan = kalan.slice(74)
  }
  if (kalan.length > 0) parcalar.push(' ' + kalan)
  return parcalar.join('\r\n')
}

/** Date → "20260803T093000Z" (UTC, zamanlı olaylar için). */
function utcDamga(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  )
}

/** "2026-08-03" → "20260803" (tüm gün olaylar için VALUE=DATE). */
function tarihDamga(gun: string): string {
  return gun.replace(/-/g, '')
}

function gunSonraki(gun: string): string {
  const d = new Date(`${gun}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return tarihDamga(d.toISOString().slice(0, 10))
}

interface IcsBaglami {
  olaylar: Olay[]
  sureler: Sure[]
  /** UID ve dosya adında kullanılacak, dizin/dosya adları. */
  dosyaAdlari: Map<string, string>
  /** DTSTAMP için sabit an (test edilebilirlik). */
  simdi: Date
}

function vevent(satirlar: string[]): string {
  return ['BEGIN:VEVENT', ...satirlar, 'END:VEVENT'].join('\r\n')
}

/** Tüm takvimi (olaylar + hukuki süreler) bir VCALENDAR metnine çevirir. */
export function icsUret(baglam: IcsBaglami): string {
  const { olaylar, sureler, dosyaAdlari, simdi } = baglam
  const dtstamp = utcDamga(simdi)
  const bloklar: string[] = []

  for (const olay of olaylar) {
    if (olay.durum === 'iptal') continue
    const gorunum = olayGorunumleri[olay.tur]
    const dosyaAdi = olay.dosyaId ? dosyaAdlari.get(olay.dosyaId) : undefined
    const ozet = dosyaAdi ? `${olay.baslik} — ${dosyaAdi}` : olay.baslik
    const satirlar = [
      `UID:olay-${olay.id}@juriscalendar`,
      `DTSTAMP:${dtstamp}`,
      `SUMMARY:${metinKacis(ozet)}`,
    ]
    if (olay.tumGun) {
      // Tüm gün olayı YEREL güne göre yazılmalı: baslangic UTC saklanır
      // (ör. yerel 15 Ağu 00:00 = 14 Ağu 21:00Z), ham `slice(0,10)` UTC gününü
      // (14 Ağu) verip olayı takvim uygulamasında bir gün ERKEN gösterirdi.
      const gun = yerelGun(olay.baslangic)
      satirlar.push(`DTSTART;VALUE=DATE:${tarihDamga(gun)}`)
      satirlar.push(`DTEND;VALUE=DATE:${gunSonraki(gun)}`)
    } else {
      const bas = new Date(olay.baslangic)
      const bit = olay.bitis
        ? new Date(olay.bitis)
        : new Date(bas.getTime() + 60 * 60 * 1000) // varsayılan 1 saat
      satirlar.push(`DTSTART:${utcDamga(bas)}`)
      satirlar.push(`DTEND:${utcDamga(bit)}`)
    }
    if (olay.yer) satirlar.push(`LOCATION:${metinKacis(olay.yer)}`)
    const aciklama = [gorunum.etiket, olay.aciklama].filter(Boolean).join(' — ')
    if (aciklama) satirlar.push(`DESCRIPTION:${metinKacis(aciklama)}`)
    satirlar.push('CATEGORIES:JurisCalendar')
    bloklar.push(vevent(satirlar))
  }

  for (const sure of sureler) {
    if (sure.durum === 'iptal') continue
    const dosyaAdi = dosyaAdlari.get(sure.dosyaId)
    const ozet = dosyaAdi
      ? `Son gün: ${sure.kuralAdi} — ${dosyaAdi}`
      : `Son gün: ${sure.kuralAdi}`
    const satirlar = [
      `UID:sure-${sure.id}@juriscalendar`,
      `DTSTAMP:${dtstamp}`,
      `SUMMARY:${metinKacis(ozet)}`,
      `DTSTART;VALUE=DATE:${tarihDamga(sure.sonTarih)}`,
      `DTEND;VALUE=DATE:${gunSonraki(sure.sonTarih)}`,
      `DESCRIPTION:${metinKacis(`${sure.kanunReferansi} · Bilgilendirme amaçlıdır, son gün teyidi kullanıcıya aittir.`)}`,
      'CATEGORIES:JurisCalendar,Süre',
    ]
    bloklar.push(vevent(satirlar))
  }

  const govde = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//JurisCalendar//TR//tr',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:JurisCalendar',
    'X-WR-TIMEZONE:Europe/Istanbul',
    ...bloklar,
    'END:VCALENDAR',
  ].join('\r\n')

  // Her fiziksel satırı katla.
  return govde
    .split('\r\n')
    .map(satirKatla)
    .join('\r\n')
}

/** Tek bir olay için ICS (takvim uygulamasına eklemek üzere). */
export function tekOlayIcs(
  olay: Olay,
  dosyaAdi: string | undefined,
  simdi: Date,
): string {
  return icsUret({
    olaylar: [olay],
    sureler: [],
    dosyaAdlari: new Map(olay.dosyaId && dosyaAdi ? [[olay.dosyaId, dosyaAdi]] : []),
    simdi,
  })
}

/**
 * Dosya adı kökünü güvenli hâle getirir. Olay başlığından türetilen ad
 * (ör. "Yılmaz / Arslan") dosya sistemi/indirme için güvensiz karakterler
 * içerebilir; `/ \ : * ? " < > |` bunlar `download` özniteliğinde tarayıcıya
 * göre ya yolu kesiyor ("…/arslan.ics") ya da bozuyor. Bunları tireye çevirir,
 * boşlukları tireler, çoklu tireyi tekiller. Türkçe harfler (ş/ı/İ/ğ/ü/ö/ç)
 * dosya adında geçerli olduğundan korunur.
 */
export function dosyaAdiTemizle(adKoku: string): string {
  return (
    adKoku
      .replace(/[/\\:*?"<>|]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || 'takvim'
  )
}

/** ICS metnini .ics dosyası olarak indirir. */
export function icsIndir(ics: string, adKoku: string): void {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const adres = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = adres
  a.download = `${dosyaAdiTemizle(adKoku)}.ics`
  a.click()
  // Revoke'u ertele: hemen iptal Safari/Firefox'ta indirmeyi bozabiliyor.
  setTimeout(() => URL.revokeObjectURL(adres), 0)
}
