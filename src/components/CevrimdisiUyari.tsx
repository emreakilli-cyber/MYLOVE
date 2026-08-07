import { Icon } from './Icon'
import { useCevrimici } from '../data/cevrimici'

/*
 * Çevrimdışı göstergesi. Local-first uygulamada çevrimdışı olmak olağandır;
 * bu yüzden alarm veren kırmızı değil, sakin bir bilgi şeridi. Yalnızca
 * çevrimdışıyken görünür ve içerik akışının başında durur.
 */
export function CevrimdisiUyari() {
  const cevrimici = useCevrimici()
  if (cevrimici) return null

  return (
    <div className="cevrimdisi" role="status" aria-live="polite">
      <Icon name="cloud-off" size={18} className="cevrimdisi-ikon" />
      <p className="cevrimdisi-metin">
        Çevrimdışısınız. Uygulama cihazınızda çalışmaya devam ediyor;
        verileriniz kaydedilir.
      </p>
    </div>
  )
}
