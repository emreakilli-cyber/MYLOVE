import { addDays, addMonths, addWeeks, addYears, isWeekend } from 'date-fns'
import { dateToIsoDate, isoDateToDate } from './tarih'

/*
 * Tekrar eden olay ve görevler.
 *
 * Yaklaşım: kural saklamak yerine seriyi **maddeleştiriyoruz** — oluşturma
 * anında her yineleme ayrı bir kayıt olarak yazılıyor ve ortak bir `seriesId`
 * ile bağlanıyor. Böylece takvim, gösterge, ICS dışa aktarma ve hatırlatma gibi
 * tüm okuma yolları hiç değişmeden çalışıyor; tek bir yinelemeyi düzenlemek de
 * doğal (o kaydı düzenlersiniz). Silerken "yalnızca bu" ya da "tüm seri" seçilir.
 */

export type TekrarSikligi =
  | 'gunluk'
  | 'hafta-ici'
  | 'haftalik'
  | '2haftalik'
  | 'aylik'
  | 'yillik'

export const tekrarEtiketleri: Record<TekrarSikligi, string> = {
  gunluk: 'Her gün',
  'hafta-ici': 'Hafta içi (Pzt–Cum)',
  haftalik: 'Her hafta',
  '2haftalik': 'İki haftada bir',
  aylik: 'Her ay',
  yillik: 'Her yıl',
}

/** Bir seride üretilebilecek azami yineleme — kotayı ve listeyi şişirmesin. */
export const MAKS_TEKRAR = 60

/**
 * Başlangıç gününden itibaren `adet` yineleme gününü ("2026-08-12") üretir.
 * İlk gün dahildir. Aylık/yıllık ay sonu taşmalarını date-fns kırpar
 * (31 Ocak + 1 ay → 28/29 Şubat). "hafta-ici" hafta sonlarını atlar.
 */
export function tekrarGunleri(
  baslangicGun: string,
  siklik: TekrarSikligi,
  adet: number,
): string[] {
  const n = Math.max(1, Math.min(MAKS_TEKRAR, Math.floor(adet)))
  const ilk = isoDateToDate(baslangicGun)
  const gunler: string[] = []

  if (siklik === 'hafta-ici') {
    let d = ilk
    // Başlangıç hafta sonuna denk gelirse ilk iş gününe kaydır.
    while (isWeekend(d)) d = addDays(d, 1)
    while (gunler.length < n) {
      if (!isWeekend(d)) gunler.push(dateToIsoDate(d))
      d = addDays(d, 1)
    }
    return gunler
  }

  const adim = (i: number): Date => {
    switch (siklik) {
      case 'gunluk':
        return addDays(ilk, i)
      case 'haftalik':
        return addWeeks(ilk, i)
      case '2haftalik':
        return addWeeks(ilk, i * 2)
      case 'aylik':
        return addMonths(ilk, i)
      case 'yillik':
        return addYears(ilk, i)
    }
  }

  for (let i = 0; i < n; i++) gunler.push(dateToIsoDate(adim(i)))
  return gunler
}
