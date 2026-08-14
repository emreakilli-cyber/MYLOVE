/*
 * Sessiz saatler — cihaz bildirimlerinin bastırıldığı yerel zaman penceresi.
 *
 * Pencere gece yarısını AŞABİLİR (ör. 22:00–08:00): akşamdan sabaha. Bu yüzden
 * basit `bas <= x < bitis` yetmez; sarma durumu ayrıca ele alınır. Saf ve
 * test edilebilir tutuldu — bildirim tetikleyici bunu çağırır.
 */

/** "HH:MM" → gün içi dakika (0–1439). Geçersiz/boşsa null. */
export function dakikaya(hhmm: string | undefined): number | null {
  if (!hhmm) return null
  const eslesme = /^(\d{2}):(\d{2})$/.exec(hhmm.trim())
  if (!eslesme) return null
  const saat = Number(eslesme[1])
  const dakika = Number(eslesme[2])
  if (saat > 23 || dakika > 59) return null
  return saat * 60 + dakika
}

/**
 * Verilen yerel dakika (0–1439) sessiz saat penceresinde mi?
 * Başlangıç dâhil, bitiş hariç. İki uçtan biri girilmemiş/geçersiz ya da ikisi
 * eşitse pencere yok sayılır → false.
 */
export function sessizSaatteMi(
  simdiDk: number,
  bas: string | undefined,
  bitis: string | undefined,
): boolean {
  const b = dakikaya(bas)
  const s = dakikaya(bitis)
  if (b === null || s === null || b === s) return false
  return b < s
    ? simdiDk >= b && simdiDk < s // aynı gün: [b, s)
    : simdiDk >= b || simdiDk < s // gece yarısını aşan: [b, 24:00) ∪ [00:00, s)
}
