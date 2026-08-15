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
  const icerikRef = useRef<HTMLDivElement>(null)
  const ekranRef = useRef<HTMLDivElement>(null)

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

  // PIN 4–8 hane olabilir; özet uzunluğu vermediğinden hedef uzunluğu
  // ayarlardan okuyup TAM o uzunlukta doğrularız. Eski kayıtta yoksa 4.
  // (Aksi hâlde 4. hanede kontrol edilip sıfırlanır, >4 haneli PIN girilemez.)
  const hedefUzunluk = ayarlar?.pinUzunlugu ?? 4

  const rakamGir = (r: string) => {
    setHata(false)
    const yeni = (pin + r).slice(0, hedefUzunluk)
    setPin(yeni)
    if (yeni.length >= hedefUzunluk) void dogrula(yeni)
  }

  // Kilitliyken arka planı ERİŞİLEMEZ kıl: `inert` odağı, tıklamayı ve ekran
  // okuyucuyu engeller. Aksi hâlde klavye/AT kullanıcısı Tab ile kilidin
  // ardındaki gezinme ve dosya verisine ulaşıp kapıyı aşabilirdi.
  useEffect(() => {
    const el = icerikRef.current
    if (el) el.inert = kilitli
  }, [kilitli])

  // Kilit ekranı açılınca odağı oraya al (fiziksel klavye + ekran okuyucu).
  useEffect(() => {
    if (kilitli) ekranRef.current?.focus()
  }, [kilitli])

  // Fiziksel klavyeyle PIN girişi: rakam tuşları hane ekler, Backspace siler.
  // Sanal tuş takımıyla aynı davranış; `pin` bağımlılığı taze kalsın diye
  // dinleyici her hanede yeniden bağlanır (ucuz).
  useEffect(() => {
    if (!kilitli) return
    const onTus = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        setHata(false)
        const yeni = (pin + e.key).slice(0, hedefUzunluk)
        setPin(yeni)
        if (yeni.length >= hedefUzunluk) void dogrula(yeni)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        setHata(false)
        setPin(pin.slice(0, -1))
      }
    }
    window.addEventListener('keydown', onTus)
    return () => window.removeEventListener('keydown', onTus)
  }, [kilitli, pin, hedefUzunluk, dogrula])

  return (
    <>
      <div ref={icerikRef} className="kilit-icerik">
        {children}
      </div>
      {maskeli && !kilitli ? (
        <div className="kilit-maske" aria-hidden="true">
          <span className="kilit-maske-mark">J</span>
        </div>
      ) : null}
      {kilitli ? (
        <div
          ref={ekranRef}
          className="kilit-ekran"
          role="dialog"
          aria-modal="true"
          aria-label="Uygulama kilidi"
          tabIndex={-1}
        >
          <span className="kilit-mark">J</span>
          <p className="kilit-baslik">JurisCalendar kilitli</p>
          <p className="kilit-alt">Devam etmek için PIN girin</p>

          <div className="pin-noktalar" aria-hidden="true">
            {Array.from({ length: hedefUzunluk }, (_, i) => (
              <span key={i} className="pin-nokta" data-dolu={i < pin.length} />
            ))}
          </div>
          {hata ? (
            <p className="kilit-hata" role="alert">
              PIN yanlış, tekrar deneyin.
            </p>
          ) : null}

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
