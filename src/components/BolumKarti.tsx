import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { Link } from '../router'

/*
 * Genel bakıştaki her bölüm aynı desende: mono etiket → serif başlık →
 * sağda "Hepsini gör ↗". Tek yerde tutuluyor ki bölümler arasında kayma olmasın.
 */

interface BolumKartiProps {
  readonly etiket: string
  readonly baslik: string
  readonly hepsiYolu?: string
  readonly hepsiEtiketi?: string
  readonly bosMesaj?: string
  readonly bos?: boolean
  readonly children: ReactNode
}

export function BolumKarti({
  etiket,
  baslik,
  hepsiYolu,
  hepsiEtiketi = 'Hepsini gör',
  bosMesaj,
  bos = false,
  children,
}: BolumKartiProps) {
  return (
    <section className="card section-card">
      <div className="section-head">
        <div>
          <p className="t-label section-eyebrow">{etiket}</p>
          <h2 className="t-title">{baslik}</h2>
        </div>
        {hepsiYolu ? (
          <Link to={hepsiYolu} className="section-link">
            {hepsiEtiketi}
            <Icon name="arrow-up-right" size={14} />
          </Link>
        ) : null}
      </div>

      {bos && bosMesaj ? (
        <p className="section-empty">{bosMesaj}</p>
      ) : (
        children
      )}
    </section>
  )
}

/** Veri gelene kadar gösterilen satır iskeleti. */
export function SatirIskeleti({ adet = 3 }: { adet?: number }) {
  return (
    <div>
      {Array.from({ length: adet }, (_, i) => (
        <div className="row" key={i}>
          <div
            className="skeleton"
            style={{ width: 38, height: 38, borderRadius: 8, flex: 'none' }}
          />
          <div className="row-main">
            <div
              className="skeleton"
              style={{ width: '62%', height: 13, marginBottom: 6 }}
            />
            <div className="skeleton" style={{ width: '42%', height: 11 }} />
          </div>
        </div>
      ))}
    </div>
  )
}
