import type { IsoDate } from './types'
import { dateToIsoDate, isoDateToDate } from './tarih'

/*
 * Türkiye resmî tatilleri ve adli tatil.
 *
 * ── UYARI ────────────────────────────────────────────────────────────
 * Dinî bayram tarihleri Diyanet İşleri Başkanlığı takvimine dayanır ve
 * resmî ilanla ±1 gün kayabilir. Buradaki bütün hesaplar bilgilendirme
 * amaçlıdır; son günün doğruluğunun teyidi kullanıcıya aittir.
 * ─────────────────────────────────────────────────────────────────────
 *
 * Süre hesabında kaydırma yönü **her zaman ileri**dir (son gün tatile denk
 * gelirse ilk iş gününe uzar). Bu, kullanıcıya olduğundan fazla zaman
 * göstermemek için önemlidir: yalnızca hukuken kesin olan günleri tatil
 * sayarız. Bu yüzden **arefe günleri** (yarım gün, adliye sabah çalışır) ve
 * **28 Ekim öğleden sonra** tam tatil sayılmaz — o günlerde süre "tatil
 * saatinde" (mesai bitiminde) hâlâ dolabilir.
 */

/** Sabit tarihli tam gün resmî tatiller: [ay, gün]. */
const SABIT_TATILLER: ReadonlyArray<readonly [number, number]> = [
  [1, 1], // Yılbaşı
  [4, 23], // Ulusal Egemenlik ve Çocuk Bayramı
  [5, 1], // Emek ve Dayanışma Günü
  [5, 19], // Atatürk'ü Anma, Gençlik ve Spor Bayramı
  [7, 15], // Demokrasi ve Millî Birlik Günü
  [8, 30], // Zafer Bayramı
  [10, 29], // Cumhuriyet Bayramı (28 Ekim öğleden sonra hariç — yarım gün)
]

/**
 * Dinî bayramların ilk günü ve süresi (tam gün sayısı).
 * Ramazan Bayramı 3 gün, Kurban Bayramı 4 gündür. Arefe günü (bir öncesi)
 * yarım gün olduğundan buraya dahil edilmez.
 *
 * Kaynak: Diyanet İşleri Başkanlığı dinî günler takvimi.
 */
interface DiniBayram {
  ilkGun: IsoDate
  gunSayisi: number
}

const DINI_BAYRAMLAR: readonly DiniBayram[] = [
  // Ramazan Bayramı (3 gün)
  { ilkGun: '2024-04-10', gunSayisi: 3 },
  { ilkGun: '2025-03-30', gunSayisi: 3 },
  { ilkGun: '2026-03-20', gunSayisi: 3 },
  { ilkGun: '2027-03-10', gunSayisi: 3 },
  { ilkGun: '2028-02-27', gunSayisi: 3 },
  { ilkGun: '2029-02-15', gunSayisi: 3 },
  { ilkGun: '2030-02-05', gunSayisi: 3 },
  // Kurban Bayramı (4 gün)
  { ilkGun: '2024-06-16', gunSayisi: 4 },
  { ilkGun: '2025-06-06', gunSayisi: 4 },
  { ilkGun: '2026-05-27', gunSayisi: 4 },
  { ilkGun: '2027-05-16', gunSayisi: 4 },
  { ilkGun: '2028-05-05', gunSayisi: 4 },
  { ilkGun: '2029-04-24', gunSayisi: 4 },
  { ilkGun: '2030-04-13', gunSayisi: 4 },
]

/** Dinî bayram tablosunun kapsadığı yıl aralığı — dışına çıkınca uyar. */
export const DINI_BAYRAM_KAPSAMI = { ilk: 2024, son: 2030 } as const

// Hızlı arama için tüm dinî bayram günlerini bir kümede tut.
const diniBayramGunleri: Set<string> = (() => {
  const kume = new Set<string>()
  for (const bayram of DINI_BAYRAMLAR) {
    const bas = isoDateToDate(bayram.ilkGun)
    for (let i = 0; i < bayram.gunSayisi; i++) {
      const g = new Date(bas)
      g.setDate(bas.getDate() + i)
      kume.add(dateToIsoDate(g))
    }
  }
  return kume
})()

/** Cumartesi veya pazar mı? */
export function haftaSonuMu(gun: IsoDate): boolean {
  const haftaGunu = isoDateToDate(gun).getDay()
  return haftaGunu === 0 || haftaGunu === 6
}

/** Sabit ya da dinî, tam gün resmî tatil mi? (Hafta sonu hariç.) */
export function resmiTatilMi(gun: IsoDate): boolean {
  const d = isoDateToDate(gun)
  const ay = d.getMonth() + 1
  const gunNo = d.getDate()
  if (SABIT_TATILLER.some(([a, g]) => a === ay && g === gunNo)) return true
  return diniBayramGunleri.has(gun)
}

/** Süre son gününü kaydıracak bir gün mü (hafta sonu veya resmî tatil)? */
export function calismaGunuDegilMi(gun: IsoDate): boolean {
  return haftaSonuMu(gun) || resmiTatilMi(gun)
}

/** Verilen günden itibaren (o gün dahil) ilk çalışma günü. */
export function ilkCalismaGunu(gun: IsoDate): IsoDate {
  let d = isoDateToDate(gun)
  while (calismaGunuDegilMi(dateToIsoDate(d))) {
    d = new Date(d)
    d.setDate(d.getDate() + 1)
  }
  return dateToIsoDate(d)
}

/**
 * O günün neden çalışma günü olmadığını açıklar — kaydırma gerekçesinde
 * kullanılır. Çalışma günüyse null.
 */
export function tatilAdi(gun: IsoDate): string | null {
  const d = isoDateToDate(gun)
  const haftaGunu = d.getDay()
  if (haftaGunu === 0) return 'pazar'
  if (haftaGunu === 6) return 'cumartesi'

  const ay = d.getMonth() + 1
  const gunNo = d.getDate()
  const sabitAd: Record<string, string> = {
    '1-1': 'yılbaşı',
    '4-23': '23 Nisan',
    '5-1': '1 Mayıs',
    '5-19': '19 Mayıs',
    '7-15': '15 Temmuz',
    '8-30': '30 Ağustos Zafer Bayramı',
    '10-29': '29 Ekim Cumhuriyet Bayramı',
  }
  const anahtar = `${ay}-${gunNo}`
  if (anahtar in sabitAd) return sabitAd[anahtar] ?? null
  if (diniBayramGunleri.has(gun)) return 'dinî bayram'
  return null
}

/* ------------------------------------------------------------------ *
 * Adli tatil (HMK m. 102–104)
 * ------------------------------------------------------------------ */

/** Adli tatil: her yıl 20 Temmuz – 31 Ağustos. */
export function adliTatildeMi(gun: IsoDate): boolean {
  const d = isoDateToDate(gun)
  const ay = d.getMonth() + 1
  const gunNo = d.getDate()
  if (ay === 8) return true // Ağustos tamamı
  if (ay === 7 && gunNo >= 20) return true // 20–31 Temmuz
  return false
}

/**
 * Adli tatilin bittiği yıla göre uzama günü: adli tatil 31 Ağustos'ta biter,
 * süre "bir hafta uzamış sayılır" → 7 Eylül (HMK m. 104).
 */
export function adliTatilUzamaGunu(gun: IsoDate): IsoDate {
  const yil = isoDateToDate(gun).getFullYear()
  return `${yil}-09-07`
}
