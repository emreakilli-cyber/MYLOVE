import { useState } from 'react'
import { Icon } from '../components/Icon'
import { SatirIskeleti } from '../components/BolumKarti'
import { Link } from '../router'
import {
  finansSuzgecEtiketleri,
  useFinansGenelOzet,
  useFinansListesi,
  type FinansSuzgeci,
} from '../data/finansSorgulari'
import { kategoriEtiketleri } from '../data/finansIslemleri'
import { tutarKisa, tutarTam } from '../domain/para'
import { kisaTarih } from '../domain/tarih'

const SUZGECLER: FinansSuzgeci[] = ['tumu', 'gelir', 'gider', 'bekleyen']

export function Finans() {
  const [suzgec, setSuzgec] = useState<FinansSuzgeci>('tumu')
  const ozet = useFinansGenelOzet()
  const satirlar = useFinansListesi(suzgec)

  return (
    <>
      <div className="form-head">
        <p className="t-label">Yürütme</p>
        <h1 className="t-title">Finans</h1>
      </div>

      {/* Büro özeti */}
      <section className="card">
        <div className="money-grid">
          <div className="money-cell accent-green">
            <span className="money-label">Bu ay tahsilat</span>
            <span className="money-value">
              {ozet ? tutarKisa(ozet.buAyTahsilat) : '…'}
            </span>
          </div>
          <div className="money-cell accent-red">
            <span className="money-label">Bu ay gider</span>
            <span className="money-value">
              {ozet ? tutarKisa(ozet.buAyGider) : '…'}
            </span>
          </div>
          <div className="money-cell accent-amber">
            <span className="money-label">Bekleyen ödeme</span>
            <span className="money-value">
              {ozet ? tutarKisa(ozet.toplamBekleyen) : '…'}
            </span>
          </div>
          <div className="money-cell accent-blue">
            <span className="money-label">Yaklaşan (7 gün)</span>
            <span className="money-value">{ozet ? ozet.yaklasanOdeme : '…'}</span>
          </div>
        </div>
      </section>

      <div className="chip-row" role="group" aria-label="Finans süzgeci">
        {SUZGECLER.map((s) => (
          <button
            key={s}
            type="button"
            className="chip"
            aria-pressed={suzgec === s}
            onClick={() => setSuzgec(s)}
          >
            {finansSuzgecEtiketleri[s]}
          </button>
        ))}
      </div>

      {satirlar === undefined ? (
        <section className="card section-card">
          <SatirIskeleti adet={5} />
        </section>
      ) : satirlar.length === 0 ? (
        <section className="card section-card">
          <p className="section-empty" role="status">Bu süzgeçte kayıt yok.</p>
        </section>
      ) : (
        <>
          <p className="list-count" role="status">
            {satirlar.length} kayıt
          </p>
          <section className="card divide-rows">
            {satirlar.map(({ kayit, dosya }) => {
              const bekliyor = kayit.odemeDurumu !== 'odendi'
              const accent = bekliyor
                ? 'amber'
                : kayit.yon === 'gelir'
                  ? 'green'
                  : 'slate'
              return (
                <Link
                  key={kayit.id}
                  to={`/finans/${kayit.id}`}
                  className={`row accent-${accent}`}
                >
                  <span className="row-tile" aria-hidden="true">
                    <Icon name="wallet" size={18} />
                  </span>
                  <span className="row-main">
                    <span className="row-title truncate">{kayit.baslik}</span>
                    <span className="row-sub truncate">
                      {[
                        kategoriEtiketleri[kayit.kategori],
                        dosya?.baslik,
                        bekliyor && kayit.vadeTarihi
                          ? `vade ${kisaTarih(kayit.vadeTarihi)}`
                          : kisaTarih(kayit.tarih),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span
                    className="money-amount"
                    style={{
                      color: bekliyor
                        ? 'var(--cat-amber-fg)'
                        : kayit.yon === 'gelir'
                          ? 'var(--cat-green-fg)'
                          : 'var(--text-secondary)',
                    }}
                  >
                    {kayit.yon === 'gelir' ? '+' : '−'}
                    {tutarTam(kayit.tutar)}
                  </span>
                </Link>
              )
            })}
          </section>
        </>
      )}

      <Link to="/finans/yeni" className="fab">
        <Icon name="plus" size={18} />
        Yeni kayıt
      </Link>
      <div className="fab-spacer" aria-hidden="true" />
    </>
  )
}
