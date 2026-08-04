import { useState } from 'react'
import { Icon } from '../components/Icon'
import { SatirIskeleti } from '../components/BolumKarti'
import { Link } from '../router'
import { gorevDurumunuDegistir } from '../data/sorgular'
import {
  gorevSuzgecEtiketleri,
  useGorevListesi,
  type GorevSatiri,
  type GorevSuzgeci,
} from '../data/gorevSorgulari'
import { kisaTarih } from '../domain/tarih'

// Varsayılan büro kullanıcısı — "Bana atanan" bunu esas alır (F6/tohum: Ayşe Kaya).
const BEN = 'kullanici-ayse'

const SUZGECLER: GorevSuzgeci[] = ['aktif', 'bana', 'oncelikli', 'tamamlanan']

const grupAksani: Record<string, string> = {
  gecikmis: 'red',
  bugun: 'red',
  yarin: 'amber',
  yaklasan: 'blue',
  vadesiz: 'slate',
  tamamlanan: 'green',
}

const oncelikAksani = { yuksek: 'red', normal: 'blue', dusuk: 'slate' } as const

function GorevSatirBileseni({ satir }: { satir: GorevSatiri }) {
  const { gorev, dosya, atanan } = satir
  const tamam = gorev.durum === 'tamamlandi'
  return (
    <div
      className={`row accent-${oncelikAksani[gorev.oncelik]}`}
      data-tamam={tamam}
    >
      <button
        type="button"
        className="task-check"
        data-tamam={tamam}
        aria-pressed={tamam}
        aria-label={`${gorev.baslik} — ${tamam ? 'geri al' : 'tamamla'}`}
        onClick={() => void gorevDurumunuDegistir(gorev)}
      >
        <Icon name="check" size={13} />
      </button>
      <Link to={`/gorevler/${gorev.id}`} className="row-main">
        <span className="row-title truncate">{gorev.baslik}</span>
        <span className="row-sub truncate">
          {[
            dosya?.baslik,
            gorev.vadeTarihi ? kisaTarih(gorev.vadeTarihi) : null,
            atanan ? atanan.ad.split(' ')[0] : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'Genel görev'}
        </span>
      </Link>
      {gorev.oncelik === 'yuksek' && !tamam ? (
        <span className="task-badge" style={{ background: 'var(--cat-red-bg)', color: 'var(--cat-red-fg)' }}>
          öncelikli
        </span>
      ) : null}
    </div>
  )
}

export function Gorevler() {
  const [suzgec, setSuzgec] = useState<GorevSuzgeci>('aktif')
  const gruplar = useGorevListesi(suzgec, BEN)

  const toplam = gruplar?.reduce((n, g) => n + g.satirlar.length, 0) ?? 0

  return (
    <>
      <div className="form-head">
        <p className="t-label">Yürütme</p>
        <h1 className="t-title">Görevler</h1>
      </div>

      <div className="chip-row" role="group" aria-label="Görev süzgeci">
        {SUZGECLER.map((s) => (
          <button
            key={s}
            type="button"
            className="chip"
            aria-pressed={suzgec === s}
            onClick={() => setSuzgec(s)}
          >
            {gorevSuzgecEtiketleri[s]}
          </button>
        ))}
      </div>

      {gruplar === undefined ? (
        <section className="card section-card">
          <SatirIskeleti adet={5} />
        </section>
      ) : toplam === 0 ? (
        <section className="card section-card">
          <p className="section-empty">
            {suzgec === 'tamamlanan'
              ? 'Tamamlanmış görev yok.'
              : suzgec === 'bana'
                ? 'Size atanmış açık görev yok.'
                : 'Bu süzgeçte görev yok.'}
          </p>
        </section>
      ) : (
        gruplar.map((grup) => (
          <section key={grup.anahtar} className="card section-card">
            <div className="section-head">
              <div>
                <p className="t-label section-eyebrow">
                  {grup.satirlar.length} görev
                </p>
                <h2
                  className="t-title"
                  style={{
                    color: `var(--cat-${grupAksani[grup.anahtar]}-fg)`,
                  }}
                >
                  {grup.baslik}
                </h2>
              </div>
            </div>
            <div className="divide-rows">
              {grup.satirlar.map((satir) => (
                <GorevSatirBileseni key={satir.gorev.id} satir={satir} />
              ))}
            </div>
          </section>
        ))
      )}

      <Link to="/gorevler/yeni" className="fab">
        <Icon name="plus" size={18} />
        Yeni görev
      </Link>
      <div className="fab-spacer" aria-hidden="true" />
    </>
  )
}
