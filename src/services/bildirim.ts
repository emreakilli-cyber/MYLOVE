import type { HatirlatmaKanali } from '../domain/types'

/*
 * Bildirim kanalı adaptörü (mimari: services/ katmanı).
 *
 * Varsayılan uygulama cihaz içidir: yalnızca "uygulama" (uygulama içi kutu) ve
 * "push" (tarayıcı Notification API) sunucusuz çalışır. SMS ve e-posta bir
 * sunucu/servis gerektirir; bu katman onları "yapılandırılmadı" olarak açıkça
 * bildirir — sessizce başarısız olup kullanıcıyı yanıltmaz.
 *
 * Bir sunucu geldiğinde SMS/e-posta gönderimi bu dosyadaki adaptör
 * değiştirilerek eklenir; arayüzün geri kalanı değişmez.
 */

export type KanalDurumu =
  | 'hazir' // kullanıma hazır
  | 'izin-gerekli' // kullanıcı izni bekliyor (push)
  | 'reddedildi' // izin reddedildi
  | 'yapilandirilmadi' // sunucu gerektiriyor, henüz yok
  | 'desteklenmiyor' // tarayıcı desteklemiyor

export interface KanalBilgisi {
  kanal: HatirlatmaKanali
  etiket: string
  aciklama: string
  durum: KanalDurumu
}

function pushDurumu(): KanalDurumu {
  if (typeof Notification === 'undefined') return 'desteklenmiyor'
  if (Notification.permission === 'granted') return 'hazir'
  if (Notification.permission === 'denied') return 'reddedildi'
  return 'izin-gerekli'
}

/** Kanalların o anki durumunu döndürür. */
export function kanalDurumlari(): KanalBilgisi[] {
  return [
    {
      kanal: 'uygulama',
      etiket: 'Uygulama içi',
      aciklama: 'Bildirimler uygulama içindeki kutuda görünür.',
      durum: 'hazir',
    },
    {
      kanal: 'push',
      etiket: 'Cihaz bildirimi',
      aciklama:
        'Uygulama açıkken cihazın bildirim merkezine düşer. Kapalıyken teslim garanti değildir.',
      durum: pushDurumu(),
    },
    {
      kanal: 'sms',
      etiket: 'SMS',
      aciklama: 'SMS gönderimi bir sunucu servisi gerektirir.',
      durum: 'yapilandirilmadi',
    },
    {
      kanal: 'eposta',
      etiket: 'E-posta',
      aciklama: 'E-posta gönderimi bir sunucu servisi gerektirir.',
      durum: 'yapilandirilmadi',
    },
  ]
}

/** Cihaz bildirimi için izin ister; sonuç durumunu döndürür. */
export async function pushIzniIste(): Promise<KanalDurumu> {
  if (typeof Notification === 'undefined') return 'desteklenmiyor'
  if (Notification.permission === 'granted') return 'hazir'
  if (Notification.permission === 'denied') return 'reddedildi'
  const sonuc = await Notification.requestPermission()
  return sonuc === 'granted'
    ? 'hazir'
    : sonuc === 'denied'
      ? 'reddedildi'
      : 'izin-gerekli'
}

/** Bir cihaz bildirimi gösterir (izin varsa). Verildi mi döndürür. */
export function cihazBildirimiGoster(
  baslik: string,
  govde: string,
): boolean {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission !== 'granted') return false
  try {
    new Notification(baslik, {
      body: govde,
      // Manifest'teki ikon; hatırlatma marka bütünlüğünü korusun.
      icon: `${import.meta.env.BASE_URL}icons/icon-192.png`,
      badge: `${import.meta.env.BASE_URL}icons/icon-192.png`,
      lang: 'tr',
    })
    return true
  } catch {
    return false
  }
}

export const kanalDurumEtiketleri: Record<KanalDurumu, string> = {
  hazir: 'Hazır',
  'izin-gerekli': 'İzin gerekli',
  reddedildi: 'Reddedildi',
  yapilandirilmadi: 'Yapılandırılmadı',
  desteklenmiyor: 'Desteklenmiyor',
}
