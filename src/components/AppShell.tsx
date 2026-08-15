import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { Drawer } from './Drawer'
import { CevrimdisiUyari } from './CevrimdisiUyari'
import { SurumYenile } from './SurumYenile'
import { useLocation, useNavigate } from '../router'
import { useAktifHatirlatmaSayisi } from '../data/hatirlatmaSorgulari'
import { useCihazBildirimTetikleyici } from '../data/bildirimTetikleyici'

interface AppShellProps {
  readonly children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const navigate = useNavigate()
  const { path } = useLocation()
  const hatirlatmaSayisi = useAktifHatirlatmaSayisi() ?? 0

  // Tetik anı gelen hatırlatmaları (izin + push kanalı + sessiz saat kapıları
  // ile) cihaz bildirimi olarak düşür — Ayarlar/Bildirimler'deki sözün gereği.
  useCihazBildirimTetikleyici()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Sayfa değişince menü kapanmalı (tarayıcı geri tuşu dahil).
  useEffect(() => setDrawerOpen(false), [path])

  // Gezinince odağı ana içeriğe taşı: klavye/ekran okuyucu kullanıcısı yeni
  // sayfada baştan devam etsin. Aksi hâlde odak <body>'ye (satır içi bağlantıdan
  // gidilince) ya da menü düğmesine (drawer'dan gidilince) düşüp "kayboluyordu".
  // İlk yüklemede odağı taşımayız. rAF ile ertelenir ki drawer'ın kendi
  // odak-iadesinden SONRA çalışıp odağı yeni sayfaya oturtsun; menüyü kapatıp
  // (yolu değiştirmeden) çıkışta yol değişmediği için bu tetiklenmez, drawer'ın
  // odağı tetikleyiciye iade etmesi korunur.
  const ilkYuk = useRef(true)
  useEffect(() => {
    if (ilkYuk.current) {
      ilkYuk.current = false
      return
    }
    const id = requestAnimationFrame(() => {
      document.getElementById('ana-icerik')?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(id)
  }, [path])

  // Rehberli tur menüyü açıp kapatabilsin (juris-drawer olayı).
  useEffect(() => {
    const dinle = (e: Event) => {
      const detay = (e as CustomEvent<{ open?: boolean }>).detail
      setDrawerOpen(Boolean(detay?.open))
    }
    window.addEventListener('juris-drawer', dinle)
    return () => window.removeEventListener('juris-drawer', dinle)
  }, [])

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  return (
    <div className="shell">
      {/* Klavye/ekran okuyucu: üst çubuğu atlayıp içeriğe geç. Hash router'ı
          tetiklememek için varsayılan gezinme engellenip odak elle taşınır. */}
      <a
        href="#ana-icerik"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('ana-icerik')?.focus()
        }}
      >
        İçeriğe geç
      </a>
      <header className="topbar" data-scrolled={scrolled}>
        <div className="topbar-inner">
          <button
            type="button"
            className="topbar-menu"
            data-tur="menu"
            onClick={() => setDrawerOpen(true)}
            aria-expanded={drawerOpen}
          >
            <Icon name="menu" size={22} title="Menüyü aç" />
          </button>

          <div className="topbar-actions">
            {/* GEÇİCİ: test sırasında sürümü tıkla-yenile. Ürün öncesi silinecek. */}
            <SurumYenile />
            <button
              type="button"
              className="icon-button"
              onClick={() => navigate('/ara')}
            >
              <Icon name="search" size={19} title="Ara" />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={
                hatirlatmaSayisi > 0
                  ? `Bildirimler, ${hatirlatmaSayisi} aktif hatırlatma`
                  : 'Bildirimler'
              }
              onClick={() => navigate('/bildirimler')}
            >
              <Icon name="bell" size={19} />
              {hatirlatmaSayisi > 0 ? (
                <span className="icon-button-dot" aria-hidden="true" />
              ) : null}
            </button>
          </div>
        </div>
      </header>

      <Drawer open={drawerOpen} onClose={closeDrawer} />

      <main id="ana-icerik" className="shell-content" tabIndex={-1}>
        <CevrimdisiUyari />
        {children}
      </main>
    </div>
  )
}
