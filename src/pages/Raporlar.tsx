import { Icon } from '../components/Icon'
import { SatirIskeleti } from '../components/BolumKarti'
import { Link } from '../router'
import {
  raporCsv,
  useRaporVerisi,
  type RaporVerisi,
} from '../data/raporSorgulari'
import { tutarKisa } from '../domain/para'

/*
 * Raporlar. Grafiklerin tamamı elle çizilmiş SVG (tasarım kısıtı); renkler
 * token'lardan gelir. Boyutlar viewBox ile oransal, kapsayıcıya göre esner.
 */

const RENK = {
  yesil: '#5fb49c',
  kirmizi: '#c96a5b',
  turuncu: '#d9a45b',
  mor: '#8e7cc3',
  mavi: '#6e93b8',
  slate: '#9aa0a0',
}

/* ---- Sütun grafiği: son 6 ay tahsilat vs gider ---- */
function SutunGrafigi({ veri }: { veri: RaporVerisi }) {
  const G = 320
  const Y = 150
  const altBosluk = 22
  const cizimY = Y - altBosluk
  const n = veri.aylikTahsilat.length
  const grupGenislik = G / n
  const cubukGenislik = grupGenislik * 0.28

  const enBuyuk = Math.max(
    1,
    ...veri.aylikTahsilat.map((a) => a.deger),
    ...veri.aylikGider.map((a) => a.deger),
  )

  const yukseklik = (deger: number) => (deger / enBuyuk) * cizimY

  return (
    <>
      <svg
        className="bar-chart"
        viewBox={`0 0 ${G} ${Y}`}
        role="img"
        aria-label="Son altı ay tahsilat ve gider"
      >
        {/* taban çizgisi */}
        <line x1="0" y1={cizimY} x2={G} y2={cizimY} stroke="#ece9e4" strokeWidth="1" />
        {veri.aylikTahsilat.map((ay, i) => {
          const merkez = i * grupGenislik + grupGenislik / 2
          const gh = yukseklik(ay.deger)
          const gih = yukseklik(veri.aylikGider[i]?.deger ?? 0)
          return (
            <g key={ay.onEk}>
              <rect
                x={merkez - cubukGenislik - 1}
                y={cizimY - gh}
                width={cubukGenislik}
                height={gh}
                rx="2"
                fill={RENK.yesil}
              />
              <rect
                x={merkez + 1}
                y={cizimY - gih}
                width={cubukGenislik}
                height={gih}
                rx="2"
                fill={RENK.kirmizi}
                opacity="0.85"
              />
              <text
                x={merkez}
                y={Y - 6}
                fontSize="9"
                textAnchor="middle"
              >
                {ay.etiket}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="bar-legend">
        <span>
          <span className="legend-dot" style={{ background: RENK.yesil }} />
          Tahsilat
        </span>
        <span>
          <span className="legend-dot" style={{ background: RENK.kirmizi }} />
          Gider
        </span>
      </div>
    </>
  )
}

/* ---- Halka: süre aciliyet dağılımı ---- */
function Halka({ veri }: { veri: RaporVerisi }) {
  const { kritik, yakin, normal } = veri.sureAciliyet
  const toplam = kritik + yakin + normal
  const dilimler = [
    { deger: kritik, renk: RENK.kirmizi, etiket: 'Kritik (≤2 gün)' },
    { deger: yakin, renk: RENK.turuncu, etiket: 'Yakın (≤7 gün)' },
    { deger: normal, renk: RENK.mavi, etiket: 'İleri' },
  ]

  const r = 34
  const cevre = 2 * Math.PI * r
  let ilerleme = 0

  return (
    <div className="donut-wrap">
      <svg className="donut" width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#f2f0ec" strokeWidth="12" />
        {toplam > 0 &&
          dilimler.map((d, i) => {
            if (d.deger === 0) return null
            const uzunluk = (d.deger / toplam) * cevre
            const dash = `${uzunluk} ${cevre - uzunluk}`
            const ofset = -ilerleme
            ilerleme += uzunluk
            return (
              <circle
                key={i}
                cx="48"
                cy="48"
                r={r}
                fill="none"
                stroke={d.renk}
                strokeWidth="12"
                strokeDasharray={dash}
                strokeDashoffset={ofset}
                transform="rotate(-90 48 48)"
              />
            )
          })}
        <text x="48" y="46" textAnchor="middle" className="donut-center-num">
          {toplam}
        </text>
        <text x="48" y="60" textAnchor="middle" className="donut-center-label">
          açık süre
        </text>
      </svg>
      <div className="donut-legend">
        {dilimler.map((d) => (
          <span key={d.etiket}>
            <span className="legend-dot" style={{ background: d.renk }} />
            {d.etiket}: {d.deger}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ---- Yatay çubuk: gider dağılımı ---- */
function GiderDagilimi({ veri }: { veri: RaporVerisi }) {
  const enBuyuk = Math.max(1, ...veri.giderDagilimi.map((g) => g.tutar))
  return (
    <div className="hbar">
      {veri.giderDagilimi.map((g) => (
        <div className="hbar-row" key={g.kategori}>
          <span className="hbar-label">{g.etiket}</span>
          <span className="hbar-value">{tutarKisa(g.tutar)}</span>
          <span className="hbar-track">
            <span
              className="hbar-fill"
              style={{
                width: `${(g.tutar / enBuyuk) * 100}%`,
                background: RENK.mor,
              }}
            />
          </span>
        </div>
      ))}
    </div>
  )
}

function csvIndir(veri: RaporVerisi): void {
  const blob = new Blob([raporCsv(veri)], { type: 'text/csv;charset=utf-8' })
  const adres = URL.createObjectURL(blob)
  const damga = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = adres
  a.download = `juriscalendar-rapor-${damga}.csv`
  a.click()
  URL.revokeObjectURL(adres)
}

export function Raporlar() {
  const veri = useRaporVerisi()

  return (
    <>
      <div className="form-head">
        <p className="t-label">Çalışma alanı</p>
        <h1 className="t-title">Raporlar</h1>
      </div>

      {veri === undefined ? (
        <section className="card section-card">
          <SatirIskeleti adet={4} />
        </section>
      ) : (
        <>
          {/* Bu ay aktivite */}
          <section className="card">
            <div className="rapor-stats">
              <div className="rapor-stat accent-red">
                <div className="rapor-stat-value">{veri.buAyDurusma}</div>
                <div className="rapor-stat-label">Bu ay duruşma</div>
              </div>
              <div className="rapor-stat accent-blue">
                <div className="rapor-stat-value">{veri.buAyGorusme}</div>
                <div className="rapor-stat-label">Müvekkil görüşmesi</div>
              </div>
              <div className="rapor-stat accent-green">
                <div className="rapor-stat-value">
                  {veri.buAyTamamlananGorev}
                </div>
                <div className="rapor-stat-label">Tamamlanan görev</div>
              </div>
            </div>
          </section>

          {/* Gelir-gider sütun */}
          <section className="card chart-card">
            <h2 className="t-title chart-title">Gelir ve gider</h2>
            <p className="chart-sub">
              Son altı ay · toplam tahsilat {tutarKisa(veri.toplamTahsilat)}
            </p>
            <SutunGrafigi veri={veri} />
          </section>

          {/* Süre aciliyet halka */}
          <section className="card chart-card">
            <h2 className="t-title chart-title">Açık süreler</h2>
            <p className="chart-sub">Aciliyete göre dağılım</p>
            <Halka veri={veri} />
          </section>

          {/* Gider dağılımı */}
          {veri.giderDagilimi.length > 0 ? (
            <section className="card chart-card">
              <h2 className="t-title chart-title">Gider dağılımı</h2>
              <p className="chart-sub">Kategoriye göre</p>
              <GiderDagilimi veri={veri} />
            </section>
          ) : null}

          {/* Dosya bazlı bakiye */}
          {veri.dosyaBakiye.length > 0 ? (
            <section className="card section-card">
              <div className="section-head">
                <div>
                  <p className="t-label section-eyebrow">Dosya bazlı</p>
                  <h2 className="t-title">Gelir–gider</h2>
                </div>
              </div>
              <div className="divide-rows">
                {veri.dosyaBakiye.map((d) => (
                  <Link
                    key={d.dosyaId}
                    to={`/dosyalar/${d.dosyaId}`}
                    className="row accent-slate"
                  >
                    <span className="row-main">
                      <span className="row-title truncate">{d.baslik}</span>
                      <span className="row-sub truncate">
                        Tahsilat {tutarKisa(d.gelir)} · Gider{' '}
                        {tutarKisa(d.gider)}
                      </span>
                    </span>
                    <span
                      className="money-amount"
                      style={{
                        color:
                          d.gelir - d.gider >= 0
                            ? 'var(--cat-green-fg)'
                            : 'var(--cat-red-fg)',
                      }}
                    >
                      {tutarKisa(d.gelir - d.gider)}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <button
            type="button"
            className="export-button"
            onClick={() => csvIndir(veri)}
          >
            <Icon name="arrow-up-right" size={15} />
            CSV olarak dışa aktar
          </button>

          <p className="t-small t-muted" style={{ padding: '0 var(--space-1)' }}>
            Raporlar cihazdaki veriden hesaplanır; hiçbir bilgi dışarı
            gönderilmez.
          </p>
        </>
      )}
    </>
  )
}
