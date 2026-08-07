/*
 * Merkezi, redaksiyonlu günlükleme.
 *
 * İlke: ham müvekkil verisi hiçbir yere düz yazılmaz. Redaksiyon çıktıdan ÖNCE
 * yapılır ("yaz sonra sil" değil). Tarayıcıda disk günlüğü yoktur; çıktı yalnızca
 * konsola gider ve konsola gitmeden önce kimlik desenleri maskelenir.
 *
 * Uygulamanın başka hiçbir yerinde doğrudan `console.*` çağrılmaz; yalnızca bu
 * dosya konsola yazar. Bir test (`gunluk.test.ts`) bu kuralı kaynak tarayarak
 * denetler (proje ESLint kullanmadığından lint yerine test kapısı — bkz. PLAN
 * F22 notu).
 */

export type GunlukSeviye = 'bilgi' | 'uyari' | 'hata'

const REDAKTE = '⟦gizli⟧'

/** Sık görülen kimlik desenlerini maskeler (TCKN, IBAN, e-posta, GSM). */
export function redakteEt(metin: string): string {
  return metin
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, REDAKTE) // e-posta
    .replace(/TR\d{2}(?:\s?\d){22}/gi, REDAKTE) // IBAN (TR + 24 hane)
    .replace(/(?:\+?90[\s-]?|0)?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g, REDAKTE) // GSM
    .replace(/\b\d{11}\b/g, REDAKTE) // TCKN (11 hane)
}

function guvenliString(ek: unknown): string {
  if (typeof ek === 'string') return ek
  try {
    return JSON.stringify(ek)
  } catch {
    return String(ek)
  }
}

// Konsola yazan TEK yer burasıdır (redaksiyon uygulandıktan sonra).
// eslint-disable-next-line no-console
const konsol = console

/**
 * Redakte ederek günlükler. `mesaj` geliştirici metnidir (ham müvekkil verisi
 * içermemeli); `ek` yine de redaksiyondan geçer.
 */
export function gunlukle(
  seviye: GunlukSeviye,
  mesaj: string,
  ek?: unknown,
): void {
  const govde = ek === undefined ? mesaj : `${mesaj} ${guvenliString(ek)}`
  const temiz = redakteEt(govde)
  if (seviye === 'hata') konsol.error(temiz)
  else if (seviye === 'uyari') konsol.warn(temiz)
  else konsol.info(temiz)
}

/** Bir hatayı (mesaj + yığın) redakte ederek günlükler. */
export function gunlukHata(hata: unknown, baglam?: string): void {
  const govde =
    hata instanceof Error
      ? `${hata.name}: ${hata.message}\n${hata.stack ?? ''}`
      : String(hata)
  gunlukle('hata', baglam ? `${baglam} — ${govde}` : govde)
}
