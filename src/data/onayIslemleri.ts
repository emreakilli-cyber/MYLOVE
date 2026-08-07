import { simdi } from './db'
import { ayarlariGuncelle } from './ayarlarIslemleri'
import { HUKUKI_METIN_SURUMU, hukukiTamMetin } from '../onboarding/hukukiMetin'
import type { Ayarlar } from '../domain/types'

/*
 * Hukuki onay durumu. Onay; tarih/saat (ISO), metin sürümü ve metin hash'iyle
 * cihaza yazılır. Metin sürümü değişince yeniden onay istenir.
 */

/** SHA-256 → hex. Onaylanan metnin parmak izini kaydetmek için. */
export async function metinHash(metin: string): Promise<string> {
  const bayt = new TextEncoder().encode(metin)
  const ozet = await crypto.subtle.digest('SHA-256', bayt)
  return [...new Uint8Array(ozet)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Onay gerekli mi? Kayıt yoksa ya da sürüm değiştiyse evet. */
export function onayGerekli(ayarlar: Ayarlar | undefined): boolean {
  const onay = ayarlar?.hukukiOnay
  return !onay || onay.surum !== HUKUKI_METIN_SURUMU
}

/** Onayı kaydeder (zaman + sürüm + hash). */
export async function onayKaydet(): Promise<void> {
  const hash = await metinHash(hukukiTamMetin())
  await ayarlariGuncelle({
    hukukiOnay: {
      zaman: simdi(),
      surum: HUKUKI_METIN_SURUMU,
      hash,
    },
  })
}
