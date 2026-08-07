import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from '../router'
import { turAdimlari } from './turAdimlari'

/*
 * Uygulama içi rehberli tur. Gerçek panelleri gezer, gerçek öğeleri spotlight ile
 * işaretler ve balonla anlatır. Router içinde mount edilir (rota değiştirebilmesi
 * için) ve çalışan uygulamanın ÜZERİNE binen bir katmandır.
 *
 * Yan menüyü açmak için `juris-drawer` CustomEvent'i yayınlar; AppShell dinler.
 *
 * Akıcılık ilkesi: sayfa/menü geçişi sürerken YALNIZCA karartma görünür; balon ve
 * halka, hedef ölçülüp hazır olunca birlikte belirir. Böylece "ortada balon →
 * zıplama" sıçraması olmaz. Balon her zaman güvenli alan (çentik/ana çubuk)
 * içinde kalacak şekilde konumlanır.
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
const ARALIK = 12 // balon ile hedef arası boşluk
const BALON_AZAMI = 340

/** Cihazın güvenli alan (çentik/ana çubuk) paylarını piksel olarak ölçer. */
function safeInsetleri(): { ust: number; alt: number } {
  if (typeof document === 'undefined') return { ust: 0, alt: 0 }
  const p = document.createElement('div')
  p.style.cssText =
    'position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;height:env(safe-area-inset-top,0px);'
  document.body.appendChild(p)
  const ust = p.offsetHeight
  p.style.height = 'env(safe-area-inset-bottom,0px)'
  const alt = p.offsetHeight
  p.remove()
  return { ust, alt }
}

export function Tur({ onBitti }: TurProps) {
  const [idx, setIdx] = useState(0)
  const [kutu, setKutu] = useState<Kutu | null>(null)
  // Geçiş sürerken (rota/menü) balon+halka gizli; hazır olunca birlikte belirir.
  const [hazir, setHazir] = useState(false)
  const [balonYuk, setBalonYuk] = useState(0)
  const balonRef = useRef<HTMLDivElement>(null)
  const [safe] = useState(safeInsetleri)
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
    setHazir(false)
    if (path !== adim.rota) navigate(adim.rota)
    drawerAyarla(Boolean(adim.drawer))

    let iptal = false
    let deneme = 0
    const zamanlayicilar: number[] = []

    // Hedefsiz adım (kapanış): ortada balon, kısa gecikmeyle belir.
    if (!adim.hedef) {
      const t = window.setTimeout(() => {
        if (iptal) return
        setKutu(null)
        setHazir(true)
      }, 120)
      zamanlayicilar.push(t)
      return () => {
        iptal = true
        for (const z of zamanlayicilar) window.clearTimeout(z)
      }
    }

    const hedef = adim.hedef
    const olcVeYaz = (el: Element) => {
      if (iptal) return
      const r = el.getBoundingClientRect()
      setKutu({ x: r.x, y: r.y, width: r.width, height: r.height })
    }

    const olc = () => {
      if (iptal) return
      const el = document.querySelector(hedef)
      if (el) {
        el.scrollIntoView({ block: 'center', inline: 'nearest' })
        // İlk ölçümde göster; geçiş (~320ms) bitene dek yeniden ölçüp son
        // konumda otur. Böylece halka öğeyi kayarken de takip eder.
        for (const gecikme of [0, 120, 260, 420]) {
          zamanlayicilar.push(
            window.setTimeout(() => {
              const guncel = document.querySelector(hedef)
              if (guncel) {
                olcVeYaz(guncel)
                if (!iptal) setHazir(true)
              }
            }, gecikme),
          )
        }
        return
      }
      deneme += 1
      if (deneme < 40) {
        zamanlayicilar.push(window.setTimeout(olc, 60))
      } else {
        // Bulunamazsa ortada balon (tur takılmasın).
        setKutu(null)
        setHazir(true)
      }
    }

    zamanlayicilar.push(window.setTimeout(olc, 140))
    return () => {
      iptal = true
      for (const z of zamanlayicilar) window.clearTimeout(z)
    }
  }, [idx, path, adim, navigate, drawerAyarla])

  // Boyut/kaydırma değişince deliği güncelle.
  useEffect(() => {
    const hedef = adim?.hedef
    if (!hedef) return
    const guncelle = () => {
      const el = document.querySelector(hedef)
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

  // Balon yüksekliğini ölç ki güvenli alana sığacak şekilde konumlansın.
  useLayoutEffect(() => {
    if (hazir && balonRef.current) {
      setBalonYuk(balonRef.current.offsetHeight)
    }
  }, [hazir, idx, kutu])

  const bitir = useCallback(() => {
    drawerAyarla(false)
    onBitti()
  }, [drawerAyarla, onBitti])

  const ileri = useCallback(() => {
    if (sonMu) {
      bitir()
      return
    }
    setHazir(false)
    setIdx((n) => n + 1)
  }, [sonMu, bitir])

  if (!adim) return null

  const vw = typeof window !== 'undefined' ? window.innerWidth : 390
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const balonGen = Math.min(BALON_AZAMI, vw - 24)
  const yuk = balonYuk || 200

  // Balonu güvenli banda sığacak şekilde hedefin altına ya da üstüne yerleştir.
  const ustSinir = safe.ust + 8
  const altSinir = vh - safe.alt - yuk - 8
  let balonStil: React.CSSProperties = {}
  if (kutu) {
    const altBosluk = vh - safe.alt - (kutu.y + kutu.height)
    const ustBosluk = kutu.y - safe.ust
    const altta = altBosluk >= yuk + ARALIK + KENAR || altBosluk >= ustBosluk
    let top = altta
      ? kutu.y + kutu.height + KENAR + ARALIK
      : kutu.y - KENAR - ARALIK - yuk
    top = Math.min(Math.max(top, ustSinir), Math.max(ustSinir, altSinir))
    const left = Math.min(
      Math.max(12, kutu.x + kutu.width / 2 - balonGen / 2),
      vw - 12 - balonGen,
    )
    balonStil = { left, top }
  }

  const halkaVar = hazir && kutu
  const ortada = hazir && !kutu

  return (
    <div className="tur" role="dialog" aria-label="Uygulama turu" aria-live="polite">
      {halkaVar ? (
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

      {hazir ? (
        <div
          ref={balonRef}
          key={idx}
          className={`tur-balon${ortada ? ' tur-balon-orta' : ''}`}
          style={balonStil}
        >
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
      ) : null}
    </div>
  )
}
