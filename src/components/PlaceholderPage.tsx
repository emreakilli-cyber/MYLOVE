import type { CSSProperties } from 'react'
import { Icon, type IconName } from './Icon'
import { Link } from '../router'

export type Accent = 'blue' | 'purple' | 'green' | 'amber' | 'red' | 'slate'

/** Token adlarını bir arada tutup bileşenlerde ham renk yazmamızı önler. */
export const accentVars: Record<Accent, CSSProperties> = {
  blue: {
    '--tile-bg': 'var(--cat-blue-bg)',
    '--tile-fg': 'var(--cat-blue-fg)',
    '--ring-color': 'var(--cat-blue-bg)',
  } as CSSProperties,
  purple: {
    '--tile-bg': 'var(--cat-purple-bg)',
    '--tile-fg': 'var(--cat-purple-fg)',
    '--ring-color': 'var(--cat-purple-bg)',
  } as CSSProperties,
  green: {
    '--tile-bg': 'var(--cat-green-bg)',
    '--tile-fg': 'var(--cat-green-fg)',
    '--ring-color': 'var(--cat-green-bg)',
  } as CSSProperties,
  amber: {
    '--tile-bg': 'var(--cat-amber-bg)',
    '--tile-fg': 'var(--cat-amber-fg)',
    '--ring-color': 'var(--cat-amber-bg)',
  } as CSSProperties,
  red: {
    '--tile-bg': 'var(--cat-red-bg)',
    '--tile-fg': 'var(--cat-red-fg)',
    '--ring-color': 'var(--cat-red-bg)',
  } as CSSProperties,
  slate: {
    '--tile-bg': 'var(--cat-slate-bg)',
    '--tile-fg': 'var(--cat-slate-fg)',
    '--ring-color': 'var(--cat-slate-bg)',
  } as CSSProperties,
}

interface PlaceholderPageProps {
  readonly crumb: string
  readonly title: string
  readonly description: string
  readonly icon: IconName
  readonly accent: Accent
  /** Yol haritasındaki hangi aşamada geleceği — dürüst bir beklenti verir. */
  readonly phase: string
  /**
   * Genel bakışın kendisi bu düzeni kullandığında "geri dön" ve "oraya git"
   * bağlantıları anlamsız kalıyor; bu yüzden ikisi de kapatılabilir.
   */
  readonly showBack?: boolean
  readonly showHomeLink?: boolean
}

export function PlaceholderPage({
  crumb,
  title,
  description,
  icon,
  accent,
  phase,
  showBack = true,
  showHomeLink = true,
}: PlaceholderPageProps) {
  return (
    <>
      {showBack ? (
        <Link to="/" className="page-back">
          <Icon name="arrow-left" size={17} />
          Genel bakışa dön
        </Link>
      ) : null}

      <section className="card placeholder" style={accentVars[accent]}>
        <div className="placeholder-ring" aria-hidden="true" />
        <div className="placeholder-body">
          <span className="placeholder-icon" aria-hidden="true">
            <Icon name={icon} size={24} />
          </span>

          <p className="t-label placeholder-crumb">Çalışma alanı / {crumb}</p>
          <h1 className="t-display placeholder-title">{title}</h1>
          <p className="t-body placeholder-text">{description}</p>

          <p className="placeholder-pill">
            <span className="placeholder-pill-dot" aria-hidden="true" />
            {phase} aşamasında hazırlanıyor
          </p>

          {showHomeLink ? (
            <div>
              <Link to="/" className="placeholder-link">
                Genel bakışa git
                <Icon name="arrow-up-right" size={15} />
              </Link>
            </div>
          ) : null}
        </div>
      </section>
    </>
  )
}
