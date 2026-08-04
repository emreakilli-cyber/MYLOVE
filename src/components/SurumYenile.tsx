import { useState } from 'react'
import { Icon } from './Icon'

/*
 * ── GEÇİCİ TEST ARACI ───────────────────────────────────────────────
 * Ana ekrana eklenmiş bir PWA, eski service worker'a yapışıp kalabiliyor:
 * yeni sürüm yayınlansa bile uygulama eskisini açmaya devam ediyor ve
 * kullanıcı silip yeniden eklemek zorunda kalıyor.
 *
 * Bu düğme o döngüyü kırar — servis çalışanını güncelletir, önbelleği boşaltır
 * ve sayfayı yeniler. Yanında da derleme kimliği duruyor ki güncellemenin
 * gerçekten geldiği gözle görülebilsin.
 *
 * Ürün sürümüne girmeden önce SİLİNECEK: bu dosya, TopBar'daki kullanımı ve
 * vite.config.ts'deki `define` bloğu birlikte kaldırılır.
 * ────────────────────────────────────────────────────────────────────
 */

type Durum = 'hazir' | 'kontrol' | 'guncel' | 'hata'

/**
 * Önbellek Cache Storage'dır; IndexedDB'ye dokunmaz.
 * Yani dosyalar, müvekkiller ve takvim kayıtları silinmez.
 */
async function onbellekleriBosalt(): Promise<void> {
  if (!('caches' in window)) return
  const adlar = await caches.keys()
  await Promise.all(adlar.map((ad) => caches.delete(ad)))
}

export function SurumYenile() {
  const [durum, setDurum] = useState<Durum>('hazir')
  const [mesaj, setMesaj] = useState<string | null>(null)

  const yenile = async () => {
    setDurum('kontrol')
    setMesaj('Yeni sürüm aranıyor…')

    try {
      const kayit = await navigator.serviceWorker?.getRegistration()

      if (kayit) {
        // Sunucudan yeni bir service worker var mı diye sor.
        await kayit.update()
        // Beklemede bir sürüm varsa hemen devralmasını söyle.
        kayit.waiting?.postMessage({ type: 'SKIP_WAITING' })
      }

      await onbellekleriBosalt()

      setDurum('guncel')
      setMesaj('Yenileniyor…')

      // Sorgu parametresi, iOS'un HTML'i bellek içi önbellekten sunmasını da engeller.
      const adres = new URL(window.location.href)
      adres.searchParams.set('v', Date.now().toString(36))
      window.location.replace(adres.toString())
    } catch (hata) {
      setDurum('hata')
      setMesaj(
        hata instanceof Error
          ? `Yenilenemedi: ${hata.message}`
          : 'Yenilenemedi.',
      )
      window.setTimeout(() => {
        setDurum('hazir')
        setMesaj(null)
      }, 4000)
    }
  }

  return (
    <>
      <button
        type="button"
        className="surum-button"
        onClick={() => void yenile()}
        disabled={durum === 'kontrol' || durum === 'guncel'}
        title={`Derleme ${__BUILD_ID__} · ${new Date(
          __BUILD_TIME__,
        ).toLocaleString('tr-TR')}`}
      >
        <Icon
          name="refresh"
          size={15}
          className="surum-icon"
          data-donuyor={durum === 'kontrol' || durum === 'guncel'}
        />
        <span className="surum-id">{__BUILD_ID__}</span>
      </button>

      {mesaj ? (
        <p className="surum-toast" role="status" data-hata={durum === 'hata'}>
          {mesaj}
        </p>
      ) : null}
    </>
  )
}
