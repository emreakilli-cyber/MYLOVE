import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { Drawer } from './Drawer'
import { CevrimdisiUyari } from './CevrimdisiUyari'
import { SurumYenile } from './SurumYenile'
import { useLocation, useNavigate } from '../router'
import { useAktifHatirlatmaSayisi } from '../data/hatirlatmaSorgulari'

interface AppShellProps {
  readonly children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const navigate = useNavigate()
  const { path } = useLocation()
  const hatirlatmaSayisi = useAktifHatirlatmaSayisi() ?? 0

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Sayfa değişince menü kapanmalı (tarayıcı geri tuşu dahil).
  useEffect(() => setDrawerOpen(false), [path])

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
      <header className="topbar" data-scrolled={scrolled}>
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
            onClick={() => navigate('/bildirimler')}
          >
            <Icon name="bell" size={19} title="Bildirimler" />
            {hatirlatmaSayisi > 0 ? (
              <span className="icon-button-dot" aria-hidden="true" />
            ) : null}
          </button>
        </div>
      </header>

      <Drawer open={drawerOpen} onClose={closeDrawer} />

      <main className="shell-content">
        <CevrimdisiUyari />
        {children}
      </main>
    </div>
  )
}
