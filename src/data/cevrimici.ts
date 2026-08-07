import { useEffect, useState } from 'react'

/*
 * Cihazın ağ durumunu izler. JurisCalendar local-first çalıştığı için çevrimdışı
 * olmak bir HATA değildir — veri cihazda durur, uygulama çalışmaya devam eder.
 * Bu kanca yalnızca kullanıcıyı bilgilendiren nazik bir gösterge için var.
 *
 * `navigator.onLine` mükemmel değildir (bazı ortamlarda yanlış "çevrimiçi"
 * diyebilir) ama tarayıcının verdiği tek sinyal budur; olay dinleyicileriyle
 * güncel tutulur.
 */
export function useCevrimici(): boolean {
  const [cevrimici, setCevrimici] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )

  useEffect(() => {
    const cevrimiciYap = () => setCevrimici(true)
    const cevrimdisiYap = () => setCevrimici(false)
    window.addEventListener('online', cevrimiciYap)
    window.addEventListener('offline', cevrimdisiYap)
    // Kanca mount olduğunda mevcut durumu bir kez daha eşitle.
    setCevrimici(navigator.onLine)
    return () => {
      window.removeEventListener('online', cevrimiciYap)
      window.removeEventListener('offline', cevrimdisiYap)
    }
  }, [])

  return cevrimici
}
