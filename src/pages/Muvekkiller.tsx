import { useState } from 'react'
import { Icon } from '../components/Icon'
import { SatirIskeleti } from '../components/BolumKarti'
import { Link } from '../router'
import { useMuvekkilListesi } from '../data/muvekkilSorgulari'
import { tutarKisa } from '../domain/para'

export function Muvekkiller() {
  const [arama, setArama] = useState('')
  const satirlar = useMuvekkilListesi(arama)

  return (
    <>
      <div className="form-head">
        <p className="t-label">Çalışma alanı</p>
        <h1 className="t-title">Müvekkiller</h1>
      </div>

      <div className="search-wrap">
        <Icon name="search" size={18} className="search-icon" />
        <input
          className="search-input"
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="İsim, telefon, e-posta, etiket…"
          aria-label="Müvekkillerde ara"
          autoComplete="off"
        />
        {arama ? (
          <button
            type="button"
            className="search-clear"
            onClick={() => setArama('')}
          >
            <Icon name="close" size={16} title="Aramayı temizle" />
          </button>
        ) : null}
      </div>

      {satirlar === undefined ? (
        <section className="card section-card">
          <SatirIskeleti adet={5} />
        </section>
      ) : satirlar.length === 0 ? (
        <section className="card section-card">
          <p className="section-empty">
            {arama ? `“${arama}” için sonuç yok.` : 'Henüz müvekkil yok.'}
          </p>
        </section>
      ) : (
        <>
          <p className="list-count">{satirlar.length} müvekkil</p>
          <section className="card divide-rows">
            {satirlar.map(({ muvekkil, acikDosya, toplamDosya, bekleyenOdeme }) => (
              <Link
                key={muvekkil.id}
                to={`/muvekkiller/${muvekkil.id}`}
                className="row accent-blue"
              >
                <span
                  className={`avatar avatar-${
                    muvekkil.tur === 'tuzel' ? 'tuzel' : 'gercek'
                  }`}
                  aria-hidden="true"
                >
                  {muvekkil.tur === 'tuzel' ? (
                    <Icon name="folder" size={18} />
                  ) : (
                    basHarfler(muvekkil.ad)
                  )}
                </span>
                <span className="row-main">
                  <span className="row-title truncate">{muvekkil.ad}</span>
                  <span className="row-sub truncate">
                    {acikDosya > 0
                      ? `${acikDosya} açık dosya`
                      : toplamDosya > 0
                        ? `${toplamDosya} kapalı dosya`
                        : 'dosya yok'}
                  </span>
                </span>
                {bekleyenOdeme > 0 ? (
                  <span className="tag accent-amber" style={{ background: 'var(--cat-amber-bg)', color: 'var(--cat-amber-fg)' }}>
                    {tutarKisa(bekleyenOdeme)}
                  </span>
                ) : null}
                <Icon name="chevron-right" size={16} className="row-chevron" />
              </Link>
            ))}
          </section>
        </>
      )}

      <Link to="/muvekkiller/yeni" className="fab">
        <Icon name="plus" size={18} />
        Yeni müvekkil
      </Link>
      <div className="fab-spacer" aria-hidden="true" />
    </>
  )
}

/** "Seda Yılmaz" → "SY" */
function basHarfler(ad: string): string {
  const parcalar = ad.trim().split(/\s+/).filter(Boolean)
  const ilk = parcalar[0]?.[0] ?? ''
  const son = parcalar.length > 1 ? (parcalar.at(-1)?.[0] ?? '') : ''
  return (ilk + son).toLocaleUpperCase('tr')
}
