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
 * Tepki ilkesi (kullanıcı geri bildirimi): "İleri"ye basınca balon metni ANINDA
 * değişir — bekletme/boş kare yok, gecikme hissi olmaz. Yeni hedef ölçülene dek
 * spotlight önceki konumunda kalır, ölçülünce oraya kısa bir kayışla oturur
 * (ortada balon sıçraması YOK). Balon her zaman güvenli alan içinde durur.
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
  // Önemli: hedef bulunana dek `kutu` SIFIRLANMAZ — böylece "İleri"den sonra
  // balon ortaya kaçıp zıplamaz; yeni hedefe kısa kayışla oturur.
  useEffect(() => {
    if (!adim) return
    if (path !== adim.rota) navigate(adim.rota)
    drawerAyarla(Boolean(adim.drawer))

    // Kapanış (hedefsiz) adım: ortada balon.
    if (!adim.hedef) {
      setKutu(null)
      return
    }

    const hedef = adim.hedef
    let iptal = false
    let deneme = 0
    const zaman: number[] = []

    const olc = () => {
      if (iptal) return
      const el = document.querySelector(hedef)
      if (el) {
        el.scrollIntoView({ block: 'center', inline: 'nearest' })
        // İlk ölçümde otur; geçiş (~320ms) bitene dek yeniden ölçüp son
        // konumda dursun (öğe kayarken de takip eder). Ayrıca hedef, geç
        // yüklenen içerik (ör. Asistan "Gündem" listesi) ekranı uzatınca
        // görünür bandın dışına düşebilir; bu durumda yeniden ortalanır ki
        // spotlight ekran dışında bir öğeyi işaret etmesin.
        for (const g of [0, 120, 260, 420]) {
          zaman.push(
            window.setTimeout(() => {
              const cur = document.querySelector(hedef)
              if (cur && !iptal) {
                let r = cur.getBoundingClientRect()
                const vy = window.innerHeight
                if (r.top > vy - 80 || r.bottom < 80) {
                  cur.scrollIntoView({ block: 'center', inline: 'nearest' })
                  r = cur.getBoundingClientRect()
                }
                setKutu({ x: r.x, y: r.y, width: r.width, height: r.height })
              }
            }, g),
          )
        }
        return
      }
      deneme += 1
      // Bulunana kadar hızlı yokla; bulunamazsa önceki kutu kalır (takılmaz).
      if (deneme < 50) zaman.push(window.setTimeout(olc, 50))
    }

    // Hızlı başla ki "İleri" sonrası gecikme hissi olmasın.
    zaman.push(window.setTimeout(olc, 20))
    return () => {
      iptal = true
      for (const t of zaman) window.clearTimeout(t)
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
    if (balonRef.current) setBalonYuk(balonRef.current.offsetHeight)
  }, [idx, kutu])

  const bitir = useCallback(() => {
    drawerAyarla(false)
    onBitti()
    // Tur kapanınca odak, kaybolan balonla birlikte <body>'ye düşmesin:
    // ana içeriğe taşı (kabuk turAktif iken devretmediği için burada yapılır).
    requestAnimationFrame(() => {
      document.getElementById('ana-icerik')?.focus({ preventScroll: true })
    })
  }, [drawerAyarla, onBitti])

  // "İleri": metin ANINDA değişsin; kutu'yu null'lamıyoruz (sıçrama olmasın).
  const ileri = useCallback(() => {
    if (sonMu) {
      bitir()
      return
    }
    setIdx((n) => n + 1)
  }, [sonMu, bitir])

  // Erişilebilirlik (diğer modallarla aynı desen): her adımda birincil eyleme
  // ("İleri") odaklan ki klavye/ekran okuyucu kullanıcısı turu sürebilsin.
  // preventScroll: balon sabit konumlu, odaklanınca sayfa zıplamasın.
  useEffect(() => {
    balonRef.current
      ?.querySelector<HTMLElement>('.tur-ileri')
      ?.focus({ preventScroll: true })
  }, [idx])

  // Esc ile kapat, Tab'ı balon içinde döndür (arka plan tur boyunca
  // erişilemez kalsın). Kabuk turAktif iken gezinme-odağını devretmediğinden
  // bu odak çalınmaz.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        bitir()
        return
      }
      if (event.key !== 'Tab') return
      const odaklanabilir = balonRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled])',
      )
      if (!odaklanabilir || odaklanabilir.length === 0) return
      const ilk = odaklanabilir[0]
      const son = odaklanabilir[odaklanabilir.length - 1]
      if (!ilk || !son) return
      if (event.shiftKey && document.activeElement === ilk) {
        event.preventDefault()
        son.focus({ preventScroll: true })
      } else if (!event.shiftKey && document.activeElement === son) {
        event.preventDefault()
        ilk.focus({ preventScroll: true })
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [bitir])

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

  const ortada = !kutu

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

      <div
        ref={balonRef}
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
    </div>
  )
}
