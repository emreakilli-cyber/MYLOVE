/*
 * Erişilebilirlik — arayüz yazı boyutu ölçeği (F23).
 *
 * Tüm ölçüler `rem` tabanlı olduğu için kök (`<html>`) font-size'ını değiştirmek
 * arayüzün tamamını orantılı büyütür. Varsayılan görsel dil değişmez; kullanıcı
 * ileri yaş/görme kolaylığı için isteğe bağlı büyütür. iOS/tarayıcı sistem
 * büyütmesi de `%` taban sayesinde korunur.
 */

export type YaziOlcegi = 'normal' | 'buyuk' | 'cokBuyuk'

export interface OlcekSecenegi {
  readonly deger: YaziOlcegi
  readonly etiket: string
  /** Kök font-size değeri. */
  readonly css: string
}

export const YAZI_OLCEKLERI: readonly OlcekSecenegi[] = [
  { deger: 'normal', etiket: 'Normal', css: '100%' },
  { deger: 'buyuk', etiket: 'Büyük', css: '112.5%' },
  { deger: 'cokBuyuk', etiket: 'Çok büyük', css: '125%' },
]

/** Ölçek anahtarını kök font-size değerine çevirir; bilinmeyen → %100. */
export function yaziOlcegiCss(olcek: YaziOlcegi | undefined): string {
  return YAZI_OLCEKLERI.find((o) => o.deger === olcek)?.css ?? '100%'
}
