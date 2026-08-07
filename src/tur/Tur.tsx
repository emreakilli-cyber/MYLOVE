import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from '../router'
import { turAdimlari } from './turAdimlari'

/*
 * Uygulama içi rehberli tur. Gerçek panelleri gezer, gerçek öğeleri spotlight ile
 * işaretler ve balonla anlatır. Router içinde mount edilir (rota değiştirebilmesi
 * için) ve çalışan uygulamanın ÜZERİNE binen bir katmandır.
 *
 * Yan menüyü açmak için `juris-drawer` CustomEvent'i yayınlar; AppShell dinler.
 */

interface Kutu {
  x: number
  y: number
  width: number
  height: number
}

interface TurProps {
  readonly onBitti: () => void
}

const KENAR = 8 // spotlight deliği çevresi payı

export function Tur({ onBitti }: TurProps) {
  const [idx, setIdx] = useState(0)
  const [kutu, setKutu] = useState<Kutu | null>(null)
  const navigate = useNavigate()
  const { path } = useLocation()

  const adim = turAdimlari[idx]
  const sonMu = idx >= turAdimlari.length - 1

  const drawerAyarla = useCallback((ac: boolean) => {
    window.dispatchEvent(new CustomEvent('juris-drawer', { detail: { open: ac } }))
  }, [])

  // Adım/rota değişince: gerekli rotaya git, menüyü ayarla, hedefi ölç.
  useEffect(() => {
    if (!adim) return
    if (path !== adim.rota) navigate(adim.rota)
    drawerAyarla(Boolean(adim.drawer))

    let iptal = false
    let deneme = 0
    const zamanlayicilar: number[] = []

    const olcVeYaz = (el: Element) => {
      if (iptal) return
      const r = el.getBoundingClientRect()
      setKutu({ x: r.x, y: r.y, width: r.width, height: r.height })
    }

    const olc = () => {
      if (iptal) return
      if (!adim.hedef) {
        setKutu(null)
        return
      }
      const el = document.querySelector(adim.hedef)
      if (el) {
        el.scrollIntoView({ block: 'center', inline: 'nearest' })
        // Menü/sayfa geçişi (~320ms) bitene dek birkaç kez yeniden ölç ki
        // spotlight öğeyi kayarken de takip etsin, son konumda otursun.
        for (const gecikme of [0, 120, 260, 420]) {
          zamanlayicilar.push(
            window.setTimeout(() => {
              const guncel = document.querySelector(adim.hedef!)
              if (guncel) olcVeYaz(guncel)
            }, gecikme),
          )
        }
        return
      }
      deneme += 1
      if (deneme < 40) {
        const t = window.setTimeout(olc, 60)
        zamanlayicilar.push(t)
      } else setKutu(null) // bulunamazsa ortada balon
    }

    zamanlayicilar.push(window.setTimeout(olc, 140))
    return () => {
      iptal = true
      for (const t of zamanlayicilar) window.clearTimeout(t)
    }
  }, [idx, path, adim, navigate, drawerAyarla])

  // Boyut/kaydırma değişince deliği güncelle.
  useEffect(() => {
    if (!adim?.hedef) return
    const guncelle = () => {
      const el = document.querySelector(adim.hedef!)
      if (el) {
        const r = el.getBoundingClientRect()
        setKutu({ x: r.x, y: r.y, width: r.width, height: r.height })
      }
    }
    window.addEventListener('resize', guncelle)
    window.addEventListener('scroll', guncelle, true)
    return () => {
      window.removeEventListener('resize', guncelle)
      window.removeEventListener('scroll', guncelle, true)
    }
  }, [adim])

  const bitir = useCallback(() => {
    drawerAyarla(false)
    onBitti()
  }, [drawerAyarla, onBitti])

  const ileri = useCallback(() => {
    if (sonMu) {
      bitir()
      return
    }
    setKutu(null)
    setIdx((n) => n + 1)
  }, [sonMu, bitir])

  if (!adim) return null

  const vw = typeof window !== 'undefined' ? window.innerWidth : 390
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800

  // Balonu hedefe göre alta/üste yerleştir; hedef yoksa ortala.
  const altta = kutu ? kutu.y + kutu.height / 2 < vh / 2 : true
  const balonStil: React.CSSProperties = kutu
    ? {
        left: Math.min(Math.max(12, kutu.x + kutu.width / 2 - 170), vw - 12 - 340),
        top: altta ? kutu.y + kutu.height + KENAR + 12 : kutu.y - KENAR - 12,
        transform: altta ? undefined : 'translateY(-100%)',
      }
    : {}

  return (
    <div className="tur" role="dialog" aria-label="Uygulama turu" aria-live="polite">
      {kutu ? (
        <>
          <svg className="tur-svg" width="100%" height="100%" aria-hidden="true">
            <defs>
              <mask id="tur-delik">
                <rect x="0" y="0" width={vw} height={vh} fill="white" />
                <rect
                  x={kutu.x - KENAR}
                  y={kutu.y - KENAR}
                  width={kutu.width + KENAR * 2}
                  height={kutu.height + KENAR * 2}
                  rx="12"
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width={vw}
              height={vh}
              fill="rgba(16, 26, 30, 0.66)"
              mask="url(#tur-delik)"
            />
          </svg>
          <div
            className="tur-halka"
            aria-hidden="true"
            style={{
              left: kutu.x - KENAR,
              top: kutu.y - KENAR,
              width: kutu.width + KENAR * 2,
              height: kutu.height + KENAR * 2,
            }}
          />
        </>
      ) : (
        <div className="tur-perde" aria-hidden="true" />
      )}

      <div className={`tur-balon${kutu ? '' : ' tur-balon-orta'}`} style={balonStil}>
        <div className="tur-balon-ust">
          <span className="tur-adim">
            {idx + 1}/{turAdimlari.length}
          </span>
          <button type="button" className="tur-atla" onClick={bitir}>
            Turu kapat
          </button>
        </div>
        <p className="tur-baslik">{adim.baslik}</p>
        <p className="tur-metin">{adim.metin}</p>
        <div className="tur-alt">
          <button type="button" className="tur-ileri" onClick={ileri}>
            {sonMu ? 'Bitir' : 'İleri'}
          </button>
        </div>
      </div>
    </div>
  )
}
