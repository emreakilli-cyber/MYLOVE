import type { IsoDate } from './types'
import { dateToIsoDate, isoDateToDate } from './tarih'
import {
  adliTatildeMi,
  adliTatilUzamaGunu,
  calismaGunuDegilMi,
  ilkCalismaGunu,
  tatilAdi,
} from './tatil'

/*
 * Hukuki süre hesaplama motoru (şartname md. 5).
 *
 * Kullanıcı yalnızca başlangıç tarihini (çoğunlukla tebligat) ve süre türünü
 * girer; motor son günü hesaplar. Kurallar:
 *
 *  - HMK m. 92/1: Süre gün olarak belirlenmişse, tebliğ ya da tefhim edildiği
 *    **gün sayılmaz**. Sayım ertesi gün başlar → son gün = başlangıç + N gün.
 *  - HMK m. 92/2: Hafta/ay/yıl süreleri, başladığı güne son hafta/ay/yılda
 *    karşılık gelen günde biter. (Hafta, 7 güne çevrilerek hesaplanır.)
 *  - HMK m. 93: Resmî tatil günleri süreye dahildir; ancak **son gün** tatile
 *    ya da hafta sonuna rastlarsa, süre takip eden ilk iş günü biter.
 *  - HMK m. 104: Adli tatile tabi işlerde, süre adli tatil (20 Tem – 31 Ağu)
 *    içinde biterse, adli tatilin bitiminden bir hafta sonrasına (7 Eylül)
 *    uzar. Sonra bu güne de tatil kaydırması uygulanır.
 *
 * Hesap **bilgilendirme amaçlıdır**; sonucun teyidi kullanıcıya aittir.
 */

export type SureBirimi = 'gun' | 'hafta' | 'ay' | 'yil'

export type BaslangicEsasi = 'teblig' | 'tefhim' | 'ogrenme' | 'karar'

export interface SureKurali {
  id: string
  ad: string
  kanun: string
  miktar: number
  birim: SureBirimi
  esas: BaslangicEsasi
  /** Adli tatilde uzar mı? İhtiyati tedbir/haciz gibi işler tabi değildir. */
  adliTatileTabi: boolean
  /** Kısa açıklama — form ve sonuç ekranında gösterilir. */
  aciklama?: string
  /** Gruplama: hangi yargı kolu. */
  kol: 'hukuk' | 'icra' | 'ceza' | 'idari' | 'is'
}

/* ------------------------------------------------------------------ *
 * Süre kataloğu
 * ------------------------------------------------------------------ */

export const SURE_KATALOGU: readonly SureKurali[] = [
  // ── Hukuk yargılaması ──
  {
    id: 'istinaf-hmk-345',
    ad: 'İstinaf başvuru süresi',
    kanun: 'HMK m. 345',
    miktar: 2,
    birim: 'hafta',
    esas: 'teblig',
    adliTatileTabi: true,
    kol: 'hukuk',
    aciklama: 'Kararın tebliğinden itibaren iki hafta.',
  },
  {
    id: 'temyiz-hmk-361',
    ad: 'Temyiz süresi (hukuk)',
    kanun: 'HMK m. 361',
    miktar: 2,
    birim: 'hafta',
    esas: 'teblig',
    adliTatileTabi: true,
    kol: 'hukuk',
    aciklama: 'İstinaf kararının tebliğinden itibaren iki hafta.',
  },
  {
    id: 'cevap-dilekcesi-hmk-127',
    ad: 'Cevap dilekçesi süresi',
    kanun: 'HMK m. 127',
    miktar: 2,
    birim: 'hafta',
    esas: 'teblig',
    adliTatileTabi: true,
    kol: 'hukuk',
    aciklama: 'Dava dilekçesinin tebliğinden itibaren iki hafta (uzatılabilir).',
  },
  {
    id: 'bilirkisi-itiraz-hmk-281',
    ad: 'Bilirkişi raporuna itiraz',
    kanun: 'HMK m. 281',
    miktar: 2,
    birim: 'hafta',
    esas: 'teblig',
    adliTatileTabi: true,
    kol: 'hukuk',
    aciklama: 'Raporun tebliğinden itibaren iki hafta.',
  },
  {
    id: 'ihtiyati-tedbire-itiraz-hmk-394',
    ad: 'İhtiyati tedbire itiraz',
    kanun: 'HMK m. 394',
    miktar: 1,
    birim: 'hafta',
    esas: 'teblig',
    adliTatileTabi: false,
    kol: 'hukuk',
    aciklama: 'Tedbir kararının tebliğ/uygulanmasından itibaren bir hafta.',
  },

  // ── İcra ve iflas ──
  {
    id: 'odeme-emrine-itiraz-iik-62',
    ad: 'Ödeme emrine itiraz',
    kanun: 'İİK m. 62',
    miktar: 7,
    birim: 'gun',
    esas: 'teblig',
    adliTatileTabi: false,
    kol: 'icra',
    aciklama: 'Ödeme emrinin tebliğinden itibaren yedi gün.',
  },
  {
    id: 'ihtiyati-hacze-itiraz-iik-265',
    ad: 'İhtiyati hacze itiraz',
    kanun: 'İİK m. 265',
    miktar: 7,
    birim: 'gun',
    esas: 'teblig',
    adliTatileTabi: false,
    kol: 'icra',
    aciklama: 'Haczin öğrenilmesinden itibaren yedi gün.',
  },
  {
    id: 'itirazin-iptali-iik-67',
    ad: 'İtirazın iptali davası',
    kanun: 'İİK m. 67',
    miktar: 1,
    birim: 'yil',
    esas: 'teblig',
    adliTatileTabi: true,
    kol: 'icra',
    aciklama: 'İtirazın tebliğinden itibaren bir yıl.',
  },

  // ── Ceza yargılaması ──
  {
    id: 'istinaf-cmk-273',
    ad: 'İstinaf başvurusu (ceza)',
    kanun: 'CMK m. 273',
    miktar: 7,
    birim: 'gun',
    esas: 'tefhim',
    adliTatileTabi: false,
    kol: 'ceza',
    aciklama: 'Hükmün tefhim veya tebliğinden itibaren yedi gün.',
  },
  {
    id: 'temyiz-cmk-291',
    ad: 'Temyiz süresi (ceza)',
    kanun: 'CMK m. 291',
    miktar: 15,
    birim: 'gun',
    esas: 'tefhim',
    adliTatileTabi: false,
    kol: 'ceza',
    aciklama: 'Bölge adliye mahkemesi kararından itibaren on beş gün.',
  },
  {
    id: 'itiraz-cmk-268',
    ad: 'Karara itiraz (ceza)',
    kanun: 'CMK m. 268',
    miktar: 7,
    birim: 'gun',
    esas: 'tefhim',
    adliTatileTabi: false,
    kol: 'ceza',
    aciklama: 'Kararın tefhim veya tebliğinden itibaren yedi gün.',
  },

  // ── İdari yargı ──
  {
    id: 'iptal-davasi-iyuk-7',
    ad: 'İptal / tam yargı davası',
    kanun: 'İYUK m. 7',
    miktar: 60,
    birim: 'gun',
    esas: 'teblig',
    adliTatileTabi: true,
    kol: 'idari',
    aciklama: 'İşlemin tebliğinden itibaren altmış gün (Danıştay/idare).',
  },
  {
    id: 'vergi-davasi-iyuk-7',
    ad: 'Vergi davası açma',
    kanun: 'İYUK m. 7',
    miktar: 30,
    birim: 'gun',
    esas: 'teblig',
    adliTatileTabi: true,
    kol: 'idari',
    aciklama: 'Tebliğden itibaren otuz gün.',
  },
  {
    id: 'idari-cevap-iyuk-16',
    ad: 'Savunma / cevap (idari)',
    kanun: 'İYUK m. 16',
    miktar: 30,
    birim: 'gun',
    esas: 'teblig',
    adliTatileTabi: true,
    kol: 'idari',
    aciklama: 'Dava dilekçesinin tebliğinden itibaren otuz gün.',
  },

  // ── İş hukuku ──
  {
    id: 'ise-iade-arabulucu-7036',
    ad: 'İşe iade — arabulucuya başvuru',
    kanun: '7036 s. K. m. 3 / İş K. m. 20',
    miktar: 1,
    birim: 'ay',
    esas: 'teblig',
    adliTatileTabi: false,
    kol: 'is',
    aciklama: 'Fesih bildiriminin tebliğinden itibaren bir ay.',
  },
  {
    id: 'arabuluculuk-dava-7036',
    ad: 'Arabuluculuktan sonra dava',
    kanun: '7036 s. K. m. 3',
    miktar: 2,
    birim: 'hafta',
    esas: 'teblig',
    adliTatileTabi: true,
    kol: 'is',
    aciklama: 'Son tutanağın düzenlenmesinden itibaren iki hafta.',
  },
]

export function kuralBul(id: string): SureKurali | undefined {
  return SURE_KATALOGU.find((k) => k.id === id)
}

/** Yargı kolu etiketleri. */
export const kolEtiketleri: Record<SureKurali['kol'], string> = {
  hukuk: 'Hukuk',
  icra: 'İcra',
  ceza: 'Ceza',
  idari: 'İdari',
  is: 'İş',
}

export const esasEtiketleri: Record<BaslangicEsasi, string> = {
  teblig: 'Tebliğ tarihi',
  tefhim: 'Tefhim tarihi',
  ogrenme: 'Öğrenme tarihi',
  karar: 'Karar tarihi',
}

/* ------------------------------------------------------------------ *
 * Tarih aritmetiği
 * ------------------------------------------------------------------ */

function gunEkle(gun: IsoDate, n: number): IsoDate {
  const d = isoDateToDate(gun)
  d.setDate(d.getDate() + n)
  return dateToIsoDate(d)
}

/**
 * Ay ekler; hedef ayda o gün yoksa (31 Ocak + 1 ay gibi) ayın son gününe
 * sabitler (HMK m. 92/2 son cümle).
 */
function ayEkle(gun: IsoDate, n: number): IsoDate {
  const d = isoDateToDate(gun)
  const hedefGun = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const ayinSonGunu = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(hedefGun, ayinSonGunu))
  return dateToIsoDate(d)
}

function yilEkle(gun: IsoDate, n: number): IsoDate {
  const d = isoDateToDate(gun)
  const hedefGun = d.getDate()
  d.setFullYear(d.getFullYear() + n)
  // 29 Şubat + 1 yıl → 28 Şubat.
  if (d.getDate() !== hedefGun) d.setDate(0)
  return dateToIsoDate(d)
}

/* ------------------------------------------------------------------ *
 * Hesaplama
 * ------------------------------------------------------------------ */

export interface SureSonucu {
  kural: SureKurali
  baslangic: IsoDate
  /** Tatil/adli tatil kaydırması uygulanmadan önceki gün. */
  hamSonTarih: IsoDate
  /** Kullanıcıya gösterilecek son gün. */
  sonTarih: IsoDate
  adliTatilUygulandi: boolean
  /** İnsan tarafından okunur kaydırma gerekçeleri (sırayla). */
  gerekceler: string[]
}

/**
 * Süre kuralını ve başlangıç tarihini alıp son günü hesaplar.
 * Tüm kurallar (tebliğ günü sayılmaz, tatil kaydırması, adli tatil) uygulanır.
 */
export function sureHesapla(kural: SureKurali, baslangic: IsoDate): SureSonucu {
  // Ham son tarih: başlangıç günü sayılmadan süre eklenir.
  let ham: IsoDate
  switch (kural.birim) {
    case 'gun':
      ham = gunEkle(baslangic, kural.miktar)
      break
    case 'hafta':
      ham = gunEkle(baslangic, kural.miktar * 7)
      break
    case 'ay':
      ham = ayEkle(baslangic, kural.miktar)
      break
    case 'yil':
      ham = yilEkle(baslangic, kural.miktar)
      break
  }

  const gerekceler: string[] = []
  let sonuc = ham
  let adliTatilUygulandi = false

  // Adli tatil: son gün adli tatile denk gelir ve kural tabiyse 7 Eylül'e uzar.
  if (kural.adliTatileTabi && adliTatildeMi(ham)) {
    sonuc = adliTatilUzamaGunu(ham)
    adliTatilUygulandi = true
    gerekceler.push('Süre adli tatile denk geldi; 7 Eylül’e uzatıldı (HMK m. 104).')
  }

  // Tatil kaydırması: son gün hafta sonu/resmî tatilse ilk iş gününe.
  if (calismaGunuDegilMi(sonuc)) {
    const ad = tatilAdi(sonuc)
    const kaydirilmis = ilkCalismaGunu(sonuc)
    gerekceler.push(
      ad
        ? `Son gün ${ad} gününe rastladı; ilk iş gününe kaydırıldı (HMK m. 93).`
        : 'Son gün tatile rastladı; ilk iş gününe kaydırıldı (HMK m. 93).',
    )
    sonuc = kaydirilmis
  }

  return {
    kural,
    baslangic,
    hamSonTarih: ham,
    sonTarih: sonuc,
    adliTatilUygulandi,
    gerekceler,
  }
}
