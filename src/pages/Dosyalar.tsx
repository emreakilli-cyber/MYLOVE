import { useState } from 'react'
import { Icon } from '../components/Icon'
import { SatirIskeleti } from '../components/BolumKarti'
import { Link } from '../router'
import {
  dosyaDurumEtiketleri,
  dosyaTuruEtiketleri,
  suzgecEtiketleri,
  useDosyaListesi,
  type DosyaSuzgeci,
} from '../data/dosyaSorgulari'
import { aciliyet, kisaTarih } from '../domain/tarih'
import { aciliyetAksani } from '../domain/olay'
import type { HazirlikOzeti } from '../domain/types'

const seviyeAksani: Record<HazirlikOzeti['seviye'], string> = {
  iyi: 'green',
  orta: 'purple',
  dikkat: 'amber',
}

const SUZGECLER: DosyaSuzgeci[] = [
  'acik',
  'durusmasi-yaklasan',
  'kapali',
  'tumu',
]

export function Dosyalar() {
  const [arama, setArama] = useState('')
  const [suzgec, setSuzgec] = useState<DosyaSuzgeci>('acik')
  const satirlar = useDosyaListesi(arama, suzgec)

  return (
    <>
      <div className="form-head">
        <p className="t-label">Çalışma alanı</p>
        <h1 className="t-title">Dosyalar</h1>
      </div>

      <div className="search-wrap">
        <Icon name="search" size={18} className="search-icon" />
        <input
          className="search-input"
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Dosya, müvekkil, esas no, mahkeme…"
          aria-label="Dosyalarda ara"
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

      <div className="chip-row" role="group" aria-label="Dosya süzgeci">
        {SUZGECLER.map((deger) => (
          <button
            key={deger}
            type="button"
            className="chip"
            aria-pressed={suzgec === deger}
            onClick={() => setSuzgec(deger)}
          >
            {suzgecEtiketleri[deger]}
          </button>
        ))}
      </div>

      {satirlar === undefined ? (
        <section className="card section-card">
          <SatirIskeleti adet={4} />
        </section>
      ) : satirlar.length === 0 ? (
        <section className="card section-card">
          <p className="section-empty" role="status">
            {arama
              ? `“${arama}” için sonuç yok.`
              : 'Bu süzgeçte dosya yok.'}
          </p>
        </section>
      ) : (
        <>
          <p className="list-count" role="status">
            {satirlar.length} dosya
          </p>
          <section className="card divide-rows">
            {satirlar.map(({ dosya, muvekkil, ozet, sonrakiIs }) => (
              <Link
                key={dosya.id}
                to={`/dosyalar/${dosya.id}`}
                className={`file-row accent-${seviyeAksani[ozet.seviye]}`}
              >
                <span className="file-row-head">
                  <span className="file-title truncate">{dosya.baslik}</span>
                  <span className="file-percent">%{ozet.yuzde}</span>
                </span>
                <span className="file-sub truncate">
                  {[muvekkil?.ad, dosya.mahkeme].filter(Boolean).join(' · ')}
                </span>

                {sonrakiIs ? (
                  <span
                    className={`file-next accent-${
                      aciliyetAksani[aciliyet(sonrakiIs.gun)]
                    }`}
                  >
                    <Icon name="calendar-clock" size={14} />
                    <span className="truncate">
                      {sonrakiIs.etiket} · {kisaTarih(sonrakiIs.gun)}
                    </span>
                  </span>
                ) : null}

                <span className="file-meta">
                  <span className="tag tag-quiet">
                    {dosyaDurumEtiketleri[dosya.durum]}
                  </span>
                  <span className="tag tag-quiet">
                    {dosyaTuruEtiketleri[dosya.tur]}
                  </span>
                  {dosya.esasNo ? (
                    <span className="tag tag-quiet">{dosya.esasNo}</span>
                  ) : null}
                </span>
              </Link>
            ))}
          </section>

          <p className="t-small t-muted" style={{ padding: '0 var(--space-1)' }}>
            Satırlarda gösterilen hukuki süreler bilgilendirme amaçlıdır; son
            günün doğruluğunu teyit etmek kullanıcının sorumluluğundadır.
          </p>
        </>
      )}

      <Link to="/dosyalar/yeni" className="fab">
        <Icon name="plus" size={18} />
        Yeni dosya
      </Link>
      <div className="fab-spacer" aria-hidden="true" />
    </>
  )
}
