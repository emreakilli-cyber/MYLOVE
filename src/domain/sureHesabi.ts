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
  {
    id: 'replik-hmk-136',
    ad: 'Cevaba cevap (replik)',
    kanun: 'HMK m. 136',
    miktar: 2,
    birim: 'hafta',
    esas: 'teblig',
    adliTatileTabi: true,
    kol: 'hukuk',
    aciklama: 'Cevap dilekçesinin tebliğinden itibaren iki hafta.',
  },
  {
    id: 'duplik-hmk-136',
    ad: 'İkinci cevap (düplik)',
    kanun: 'HMK m. 136',
    miktar: 2,
    birim: 'hafta',
    esas: 'teblig',
    adliTatileTabi: true,
    kol: 'hukuk',
    aciklama: 'Cevaba cevabın tebliğinden itibaren iki hafta.',
  },
  {
    id: 'istinaf-cevap-hmk-347',
    ad: 'İstinaf dilekçesine cevap',
    kanun: 'HMK m. 347',
    miktar: 2,
    birim: 'hafta',
    esas: 'teblig',
    adliTatileTabi: true,
    kol: 'hukuk',
    aciklama: 'İstinaf dilekçesinin tebliğinden itibaren iki hafta.',
  },
  {
    id: 'yargilamanin-iadesi-hmk-377',
    ad: 'Yargılamanın iadesi',
    kanun: 'HMK m. 377',
    miktar: 3,
    birim: 'ay',
    esas: 'ogrenme',
    adliTatileTabi: true,
    kol: 'hukuk',
    aciklama: 'Sebebin öğrenilmesinden itibaren üç ay (her hâlde on yıl sınırı ayrıca vardır).',
  },
  {
    id: 'hakem-iptal-hmk-439',
    ad: 'Hakem kararına karşı iptal davası',
    kanun: 'HMK m. 439',
    miktar: 1,
    birim: 'ay',
    esas: 'teblig',
    adliTatileTabi: true,
    kol: 'hukuk',
    aciklama: 'Hakem kararının tebliğinden itibaren bir ay.',
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
  {
    id: 'sikayet-iik-16',
    ad: 'İcra işlemine şikayet',
    kanun: 'İİK m. 16',
    miktar: 7,
    birim: 'gun',
    esas: 'ogrenme',
    adliTatileTabi: false,
    kol: 'icra',
    aciklama: 'İşlemin öğrenilmesinden itibaren yedi gün (süresiz şikayet hâlleri saklıdır).',
  },
  {
    id: 'gecikmis-itiraz-iik-65',
    ad: 'Gecikmiş itiraz',
    kanun: 'İİK m. 65',
    miktar: 3,
    birim: 'gun',
    esas: 'ogrenme',
    adliTatileTabi: false,
    kol: 'icra',
    aciklama: 'Engelin kalkmasından itibaren üç gün.',
  },
  {
    id: 'kambiyo-itiraz-iik-168',
    ad: 'Kambiyo ödeme emrine itiraz',
    kanun: 'İİK m. 168',
    miktar: 5,
    birim: 'gun',
    esas: 'teblig',
    adliTatileTabi: false,
    kol: 'icra',
    aciklama: 'Kambiyo senedine mahsus takipte ödeme emrinin tebliğinden itibaren beş gün.',
  },
  {
    id: 'ihalenin-feshi-iik-134',
    ad: 'İhalenin feshi talebi',
    kanun: 'İİK m. 134',
    miktar: 7,
    birim: 'gun',
    esas: 'ogrenme',
    adliTatileTabi: false,
    kol: 'icra',
    aciklama: 'İhalenin öğrenilmesinden itibaren yedi gün.',
  },
  {
    id: 'istirdat-iik-72',
    ad: 'İstirdat davası',
    kanun: 'İİK m. 72',
    miktar: 1,
    birim: 'yil',
    esas: 'ogrenme',
    adliTatileTabi: true,
    kol: 'icra',
    aciklama: 'Ödeme tarihinden itibaren bir yıl (borçlu olmadığı hâlde ödenen para için).',
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
  {
    id: 'eski-hale-getirme-cmk-42',
    ad: 'Eski hâle getirme talebi',
    kanun: 'CMK m. 42',
    miktar: 7,
    birim: 'gun',
    esas: 'ogrenme',
    adliTatileTabi: false,
    kol: 'ceza',
    aciklama: 'Engelin kalkmasından itibaren yedi gün.',
  },
  {
    id: 'tazminat-cmk-142',
    ad: 'Koruma tedbiri tazminatı',
    kanun: 'CMK m. 142',
    miktar: 3,
    birim: 'ay',
    esas: 'teblig',
    adliTatileTabi: false,
    kol: 'ceza',
    aciklama: 'Kararın kesinleştiğinin tebliğinden itibaren üç ay (her hâlde bir yıl sınırı vardır).',
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
  {
    id: 'ust-makam-basvuru-iyuk-11',
    ad: 'Üst makama başvuru',
    kanun: 'İYUK m. 11',
    miktar: 60,
    birim: 'gun',
    esas: 'teblig',
    adliTatileTabi: true,
    kol: 'idari',
    aciklama: 'İşlemin tebliğinden itibaren dava süresi içinde (altmış gün) üst makama başvuru.',
  },
  {
    id: 'yd-itiraz-iyuk-27',
    ad: 'Yürütmeyi durdurmaya itiraz',
    kanun: 'İYUK m. 27',
    miktar: 7,
    birim: 'gun',
    esas: 'teblig',
    adliTatileTabi: false,
    kol: 'idari',
    aciklama: 'Yürütmeyi durdurma kararının tebliğinden itibaren yedi gün.',
  },
  {
    id: 'tam-yargi-eylem-iyuk-13',
    ad: 'İdari eylemden tam yargı',
    kanun: 'İYUK m. 13',
    miktar: 1,
    birim: 'yil',
    esas: 'ogrenme',
    adliTatileTabi: true,
    kol: 'idari',
    aciklama: 'Eylemin öğrenilmesinden itibaren bir yıl içinde önce idareye başvuru (her hâlde beş yıl).',
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
