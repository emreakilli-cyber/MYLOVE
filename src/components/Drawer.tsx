import { useEffect, useRef } from 'react'
import { Icon } from './Icon'
import { Link, useIsActive } from '../router'
import { navGroups, settingsItem, type NavItem } from '../app/navigation'
import { useAyarlar } from '../data/sorgular'

/** Ad-soyaddan iki harfli baş harf (avatar). */
function basHarfleri(ad: string): string {
  const p = ad.trim().split(/\s+/).filter(Boolean)
  if (p.length === 0) return 'JC'
  const ilk = p[0]![0] ?? ''
  const son = p.length > 1 ? (p[p.length - 1]![0] ?? '') : ''
  return (ilk + son).toLocaleUpperCase('tr')
}

interface DrawerProps {
  readonly open: boolean
  readonly onClose: () => void
  /** Rehberli tur açıkken menü yalnızca GÖSTERİLİR; odak/Esc/kaydırma kilidini
   * tur yönetir (aksi hâlde menü açılınca odak turun balonundan çalınırdı). */
  readonly turAktif?: boolean
}

function DrawerLink({
  item,
  onNavigate,
}: {
  item: NavItem
  onNavigate: () => void
}) {
  const active = useIsActive(item.path, item.exact ?? false)
  return (
    <Link
      to={item.path}
      className="drawer-link"
      onNavigate={onNavigate}
      {...(active ? { ariaCurrent: 'page' as const } : {})}
    >
      <Icon name={item.icon} size={19} className="drawer-link-icon" />
      <span>{item.label}</span>
      {active ? <span className="drawer-link-dot" aria-hidden="true" /> : null}
    </Link>
  )
}

export function Drawer({ open, onClose, turAktif = false }: DrawerProps) {
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const ayarlar = useAyarlar()
  const ad = ayarlar?.kullaniciAdi?.trim() || 'JurisCalendar'
  const unvan = ayarlar?.unvan?.trim() || 'Kullanıcı'

  // Kapalıyken panel ekran dışında ama `<a>`/`<button>` çocukları hâlâ odaklanır
  // durumda kalıyordu: Tab ile görünmez, `aria-hidden` bir ağaca odak düşerdi
  // (ARIA ihlali + klavye kullanıcısı için "kaybolan" odak). `inert` bunu kökten
  // çözer — kapalıyken odak/etkileşim/AT dışı.
  useEffect(() => {
    const el = panelRef.current
    if (el) el.inert = !open
  }, [open])

  // Açıkken arka planın kaymasını durdur, Esc ile kapat, odağı panele al.
  // Tur açıkken atlanır: menü yalnızca spotlight için gösterilir, odak/Esc/
  // kaydırma kilidini tur yönetir (yoksa menü açılınca odak balondan çalınır).
  useEffect(() => {
    if (!open || turAktif) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    closeRef.current?.focus()

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      // Odağı panel içinde döndür.
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      )
      if (!focusables || focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      previouslyFocused?.focus()
    }
  }, [open, onClose, turAktif])

  return (
    <>
      <div
        className="scrim"
        data-open={open}
        onClick={onClose}
        aria-hidden="true"
      />
      <nav
        ref={panelRef}
        className="drawer"
        data-open={open}
        aria-label="Ana gezinme"
        aria-hidden={!open}
      >
        <div className="drawer-header">
          <span className="drawer-mark" aria-hidden="true">
            J
          </span>
          <span className="drawer-wordmark">
            <span className="drawer-wordmark-name">Juris</span>
            <span className="drawer-wordmark-sub">Calendar</span>
          </span>
          <button
            ref={closeRef}
            type="button"
            className="drawer-close"
            onClick={onClose}
          >
            <Icon name="close" size={20} title="Menüyü kapat" />
          </button>
        </div>

        {navGroups.map((group) => (
          <div key={group.label} className="drawer-group">
            <p className="drawer-group-label">{group.label}</p>
            {group.items.map((item) => (
              <DrawerLink key={item.path} item={item} onNavigate={onClose} />
            ))}
          </div>
        ))}

        <div className="drawer-status">
          <p className="drawer-status-title">
            <span className="drawer-status-dot" aria-hidden="true" />
            Sistem hazır
          </p>
          <p className="drawer-status-body">
            Verileriniz bu cihazda saklanıyor; çalışmak için bağlantı gerekmiyor.
          </p>
        </div>

        <div className="drawer-spacer" />
        <div className="drawer-divider" />

        <DrawerLink item={settingsItem} onNavigate={onClose} />

        <Link to="/ayarlar" className="drawer-user" onNavigate={onClose}>
          <span className="drawer-user-avatar" aria-hidden="true">
            {basHarfleri(ad)}
          </span>
          <span className="drawer-user-text">
            <span className="drawer-user-name">{ad}</span>
            <span className="drawer-user-role">{unvan}</span>
          </span>
          <Icon name="chevron-down" size={18} />
        </Link>
      </nav>
    </>
  )
}
