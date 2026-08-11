import { useState } from 'react'
import { Icon } from '../components/Icon'
import { SatirIskeleti } from '../components/BolumKarti'
import { Link } from '../router'
import {
  raporCsv,
  useRaporVerisi,
  varsayilanRaporAraligi,
  type RaporVerisi,
} from '../data/raporSorgulari'
import { tutarKisa } from '../domain/para'
import { dateToIsoDate, kisaTarih } from '../domain/tarih'
import type { IsoDate } from '../domain/types'

type Preset = 'bu-ay' | 'son-3' | 'son-6' | 'son-12' | 'bu-yil' | 'serbest'

const PRESETLER: ReadonlyArray<{ id: Preset; etiket: string }> = [
  { id: 'bu-ay', etiket: 'Bu ay' },
  { id: 'son-3', etiket: 'Son 3 ay' },
  { id: 'son-6', etiket: 'Son 6 ay' },
  { id: 'son-12', etiket: 'Son 12 ay' },
  { id: 'bu-yil', etiket: 'Bu yıl' },
  { id: 'serbest', etiket: 'Serbest' },
]

function presetAralik(p: Preset): { baslangic: IsoDate; bitis: IsoDate } {
  const bugun = new Date()
  const bitis = dateToIsoDate(bugun)
  const ayIlki = (geriAy: number) =>
    dateToIsoDate(new Date(bugun.getFullYear(), bugun.getMonth() - geriAy, 1))
  switch (p) {
    case 'bu-ay':
      return { baslangic: ayIlki(0), bitis }
    case 'son-3':
      return { baslangic: ayIlki(2), bitis }
    case 'son-12':
      return { baslangic: ayIlki(11), bitis }
    case 'bu-yil':
      return { baslangic: dateToIsoDate(new Date(bugun.getFullYear(), 0, 1)), bitis }
    case 'son-6':
    default:
      return varsayilanRaporAraligi()
  }
}

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
  const [preset, setPreset] = useState<Preset>('son-6')
  const [aralik, setAralik] = useState(() => varsayilanRaporAraligi())
  const veri = useRaporVerisi(aralik.baslangic, aralik.bitis)

  const presetSec = (p: Preset) => {
    setPreset(p)
    if (p !== 'serbest') setAralik(presetAralik(p))
  }

  const aralikEtiketi = `${kisaTarih(aralik.baslangic)} – ${kisaTarih(aralik.bitis)}`

  return (
    <>
      <div className="form-head">
        <p className="t-label">Çalışma alanı</p>
        <h1 className="t-title">Raporlar</h1>
      </div>

      {/* Tarih aralığı seçimi */}
      <section className="card form-card rapor-aralik">
        <div className="chip-row" role="group" aria-label="Tarih aralığı" style={{ marginInline: 0, paddingInline: 0 }}>
          {PRESETLER.map((p) => (
            <button
              key={p.id}
              type="button"
              className="chip"
              aria-pressed={preset === p.id}
              onClick={() => presetSec(p.id)}
            >
              {p.etiket}
            </button>
          ))}
        </div>
        {preset === 'serbest' ? (
          <div className="field-row">
            <label className="field">
              <span className="field-label">Başlangıç</span>
              <input
                type="date"
                className="input"
                value={aralik.baslangic}
                max={aralik.bitis}
                onChange={(e) =>
                  setAralik((a) => ({ ...a, baslangic: e.target.value }))
                }
              />
            </label>
            <label className="field">
              <span className="field-label">Bitiş</span>
              <input
                type="date"
                className="input"
                value={aralik.bitis}
                min={aralik.baslangic}
                onChange={(e) =>
                  setAralik((a) => ({ ...a, bitis: e.target.value }))
                }
              />
            </label>
          </div>
        ) : null}
      </section>

      {veri === undefined ? (
        <section className="card section-card">
          <SatirIskeleti adet={4} />
        </section>
      ) : (
        <>
          {/* Seçili dönem aktivite */}
          <section className="card">
            <div className="rapor-stats">
              <div className="rapor-stat accent-red">
                <div className="rapor-stat-value">{veri.donemDurusma}</div>
                <div className="rapor-stat-label">Duruşma</div>
              </div>
              <div className="rapor-stat accent-blue">
                <div className="rapor-stat-value">{veri.donemGorusme}</div>
                <div className="rapor-stat-label">Müvekkil görüşmesi</div>
              </div>
              <div className="rapor-stat accent-green">
                <div className="rapor-stat-value">
                  {veri.donemTamamlananGorev}
                </div>
                <div className="rapor-stat-label">Tamamlanan görev</div>
              </div>
            </div>
          </section>

          {/* Gelir-gider sütun */}
          <section className="card chart-card">
            <h2 className="t-title chart-title">Gelir ve gider</h2>
            <p className="chart-sub">
              {aralikEtiketi} · toplam tahsilat {tutarKisa(veri.toplamTahsilat)}
            </p>
            <SutunGrafigi veri={veri} />
          </section>

          {/* Süre aciliyet halka */}
          <section className="card chart-card">
            <h2 className="t-title chart-title">Açık süreler</h2>
            <p className="chart-sub">Aciliyete göre dağılım · anlık durum</p>
            <Halka veri={veri} />
            <p
              className="t-small t-muted"
              style={{ marginTop: 'var(--space-3)' }}
            >
              Süre kayıtları bilgilendirme amaçlıdır; son günün doğruluğunu teyit
              etmek kullanıcının sorumluluğundadır.
            </p>
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
