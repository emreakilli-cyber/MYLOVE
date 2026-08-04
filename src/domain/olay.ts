import type { IconName } from '../components/Icon'
import type { OlayTuru } from './types'

/*
 * Olay türlerinin görünümü. Genel bakış, takvim ve dosya detayı aynı renk ve
 * ikonu kullansın diye tek yerde tanımlı — referanstaki renk kodlaması buradan
 * besleniyor.
 */

export type Accent = 'red' | 'amber' | 'purple' | 'blue' | 'green' | 'slate'

export interface OlayGorunumu {
  readonly etiket: string
  readonly accent: Accent
  readonly icon: IconName
}

export const olayGorunumleri: Record<OlayTuru, OlayGorunumu> = {
  durusma: { etiket: 'Duruşma', accent: 'red', icon: 'calendar' },
  icra: { etiket: 'İcra takibi', accent: 'purple', icon: 'wallet' },
  'muvekkil-gorusmesi': {
    etiket: 'Müvekkil görüşmesi',
    accent: 'blue',
    icon: 'users',
  },
  'dilekce-teslimi': {
    etiket: 'Dilekçe teslimi',
    accent: 'amber',
    icon: 'checklist',
  },
  arabuluculuk: { etiket: 'Arabuluculuk', accent: 'amber', icon: 'users' },
  kesif: { etiket: 'Keşif', accent: 'green', icon: 'map-pin' },
  'son-tarih': { etiket: 'Son tarih', accent: 'red', icon: 'calendar-clock' },
  diger: { etiket: 'Diğer', accent: 'slate', icon: 'calendar' },
}

/** Yeni olay formundaki sıra — en sık kullanılan üstte. */
export const olayTurleri: readonly OlayTuru[] = [
  'durusma',
  'muvekkil-gorusmesi',
  'son-tarih',
  'dilekce-teslimi',
  'kesif',
  'arabuluculuk',
  'icra',
  'diger',
]

/** Aciliyete göre son tarih rengi. */
export const aciliyetAksani: Record<
  'gecti' | 'kritik' | 'yakin' | 'normal',
  Accent
> = {
  gecti: 'red',
  kritik: 'red',
  yakin: 'amber',
  normal: 'blue',
}
