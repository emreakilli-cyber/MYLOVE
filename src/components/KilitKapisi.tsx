import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { useAyarlar } from '../data/sorgular'
import { pinDogrula } from '../services/kripto'
import { biyometriDogrula } from '../services/biyometri'

/*
 * Uygulama kilidi ve arka plan maskeleme.
 *
 * Dürüst çerçeve: veri IndexedDB'de düz durduğu için bu kilit bir ERİŞİM
 * kapısıdır (omuz üstünden bakma, ödünç verilen telefon), disk şifrelemesi
 * değil — onu iOS'un kendi cihaz şifrelemesi sağlar. Yine de meslek sırrı için
 * anlamlı bir engel: uygulama açılışta ve arka plandan uzun süre sonra PIN
 * ister, arka plandayken içerik maskelenir (uygulama değiştirici önizlemesi).
 *
 * "Açık" durumu sessionStorage'da tutulur: sekme kapanınca sıfırlanır, yani
 * her yeni oturumda yeniden PIN sorulur.
 */

const OTURUM_ANAHTARI = 'juris-kilit-acildi'

interface KilitKapisiProps {
  readonly children: ReactNode
}

export function KilitKapisi({ children }: KilitKapisiProps) {
  const ayarlar = useAyarlar()
  const kilitAktif = Boolean(ayarlar?.kilitEtkin && ayarlar.pinOzeti)

  const [kilitli, setKilitli] = useState(false)
  const [maskeli, setMaskeli] = useState(false)
  const [pin, setPin] = useState('')
  const [hata, setHata] = useState(false)
  const gizlenmeAni = useRef<number | null>(null)

  // İlk yükleme / ayar değişiminde kilit durumunu belirle.
  useEffect(() => {
    if (!kilitAktif) {
      setKilitli(false)
      return
    }
    const acildi = sessionStorage.getItem(OTURUM_ANAHTARI) === '1'
    setKilitli(!acildi)
  }, [kilitAktif])

  // Arka plan: gizlenince maskele + zamanı kaydet; dönünce zaman aşımını uygula.
  useEffect(() => {
    if (!kilitAktif) {
      setMaskeli(false)
      return
    }
    const zamanAsimiMs = (ayarlar?.oturumZamanAsimiDk ?? 5) * 60_000

    const gorunurluk = () => {
      if (document.visibilityState === 'hidden') {
        setMaskeli(true)
        gizlenmeAni.current = Date.now()
      } else {
        setMaskeli(false)
        const gizli = gizlenmeAni.current
        if (gizli !== null && Date.now() - gizli >= zamanAsimiMs) {
          sessionStorage.removeItem(OTURUM_ANAHTARI)
          setKilitli(true)
        }
        gizlenmeAni.current = null
      }
    }

    document.addEventListener('visibilitychange', gorunurluk)
    return () => document.removeEventListener('visibilitychange', gorunurluk)
  }, [kilitAktif, ayarlar?.oturumZamanAsimiDk])

  const ac = useCallback(() => {
    sessionStorage.setItem(OTURUM_ANAHTARI, '1')
    setKilitli(false)
    setPin('')
    setHata(false)
  }, [])

  const dogrula = useCallback(
    async (girilen: string) => {
      if (!ayarlar?.pinOzeti) return
      if (await pinDogrula(girilen, ayarlar.pinOzeti)) {
        ac()
      } else {
        setHata(true)
        setPin('')
      }
    },
    [ayarlar?.pinOzeti, ac],
  )

  const biyometriKimlik = ayarlar?.biyometriKimlikB64
  const biyometriDene = useCallback(async () => {
    if (!biyometriKimlik) return
    if (await biyometriDogrula(biyometriKimlik)) ac()
  }, [biyometriKimlik, ac])

  const rakamGir = (r: string) => {
    setHata(false)
    const yeni = (pin + r).slice(0, 8)
    setPin(yeni)
    if (yeni.length >= 4) void dogrula(yeni)
  }

  return (
    <>
      {children}
      {maskeli && !kilitli ? (
        <div className="kilit-maske" aria-hidden="true">
          <span className="kilit-maske-mark">J</span>
        </div>
      ) : null}
      {kilitli ? (
        <div className="kilit-ekran" role="dialog" aria-label="Uygulama kilidi">
          <span className="kilit-mark">J</span>
          <p className="kilit-baslik">JurisCalendar kilitli</p>
          <p className="kilit-alt">Devam etmek için PIN girin</p>

          <div className="pin-noktalar" aria-hidden="true">
            {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
              <span key={i} className="pin-nokta" data-dolu={i < pin.length} />
            ))}
          </div>
          {hata ? <p className="kilit-hata">PIN yanlış, tekrar deneyin.</p> : null}

          {biyometriKimlik ? (
            <button
              type="button"
              className="kilit-biyometri"
              onClick={() => void biyometriDene()}
            >
              <Icon name="lock" size={18} />
              Face ID / Touch ID ile aç
            </button>
          ) : null}

          <div className="pin-pad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((r) => (
              <button
                key={r}
                type="button"
                className="pin-tus"
                onClick={() => rakamGir(r)}
              >
                {r}
              </button>
            ))}
            <span />
            <button type="button" className="pin-tus" onClick={() => rakamGir('0')}>
              0
            </button>
            <button
              type="button"
              className="pin-tus pin-tus-sil"
              onClick={() => {
                setHata(false)
                setPin((p) => p.slice(0, -1))
              }}
              aria-label="Sil"
            >
              <Icon name="arrow-left" size={20} />
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
