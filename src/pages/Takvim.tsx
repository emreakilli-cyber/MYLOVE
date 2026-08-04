import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { Icon } from '../components/Icon'
import { SatirIskeleti } from '../components/BolumKarti'
import { Link } from '../router'
import {
  haftaSinirlari,
  useAjanda,
  useAyOgeleri,
  useHaftaOgeleri,
  type TakvimOgesi,
} from '../data/takvimSorgulari'
import {
  bugunIso,
  dateToIsoDate,
  gunFarki,
  isoDateToDate,
  tamTarih,
} from '../domain/tarih'
import type { IsoDate } from '../domain/types'

type Gorunum = 'ay' | 'hafta' | 'ajanda'

const HAFTA_GUNLERI = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

/* ------------------------------------------------------------------ *
 * Ortak satır
 * ------------------------------------------------------------------ */

function OgeSatiri({ oge }: { oge: TakvimOgesi }) {
  const icerik = (
    <>
      <span className="cal-marker" aria-hidden="true" />
      <span className="cal-time" data-gunboyu={oge.saat === undefined}>
        {oge.saat ?? (oge.kaynak === 'sure' ? 'son gün' : 'tüm gün')}
      </span>
      <span className="row-main">
        <span className="row-title truncate">{oge.baslik}</span>
        {oge.altBaslik ? (
          <span className="row-sub truncate">{oge.altBaslik}</span>
        ) : null}
        {oge.yer ? (
          <span className="event-meta">
            <Icon name="map-pin" size={13} />
            <span className="truncate">{oge.yer}</span>
          </span>
        ) : null}
      </span>
      <Icon name={oge.icon} size={17} className="row-chevron" />
    </>
  )

  const sinif = `row accent-${oge.accent}`

  // Olaya dokununca düzenleme formu açılır. Süreler motorun ürettiği kayıtlar
  // olduğu için elle düzenlenmez; onlar dosyasına götürür.
  const hedef =
    oge.kaynak === 'olay'
      ? `/takvim/olay/${oge.id}`
      : oge.dosyaId
        ? `/dosyalar/${oge.dosyaId}`
        : null

  return hedef ? (
    <Link to={hedef} className={sinif}>
      {icerik}
    </Link>
  ) : (
    <div className={sinif} data-tamamlandi={oge.tamamlandi}>
      {icerik}
    </div>
  )
}

function GunListesi({ ogeler }: { ogeler: TakvimOgesi[] }) {
  if (ogeler.length === 0) {
    return <p className="section-empty">Bu gün için kayıt yok.</p>
  }
  return (
    <div className="divide-rows">
      {ogeler.map((oge) => (
        <OgeSatiri key={`${oge.kaynak}-${oge.id}`} oge={oge} />
      ))}
    </div>
  )
}

/** "Bugün" / "Yarın" / "Salı" — gün başlığındaki ikinci satır. */
function gunEtiketi(gun: IsoDate): string {
  const fark = gunFarki(gun)
  if (fark === 0) return 'Bugün'
  if (fark === 1) return 'Yarın'
  if (fark === -1) return 'Dün'
  return format(isoDateToDate(gun), 'EEEE', { locale: tr })
}

/* ------------------------------------------------------------------ *
 * Ay görünümü
 * ------------------------------------------------------------------ */

function AyGorunumu({
  ankraj,
  secili,
  onSec,
}: {
  ankraj: Date
  secili: IsoDate
  onSec: (gun: IsoDate) => void
}) {
  const yil = ankraj.getFullYear()
  const ay = ankraj.getMonth()
  const ogeHaritasi = useAyOgeleri(yil, ay)
  const bugun = bugunIso()

  // Izgara pazartesiden başlar ve 6 tam hafta gösterir; ay uzunluğu değişse de
  // yükseklik sabit kalsın, alttaki liste zıplamasın.
  const gunler = useMemo(() => {
    const ilk = new Date(yil, ay, 1)
    const kaydirma = (ilk.getDay() + 6) % 7
    const baslangic = new Date(yil, ay, 1 - kaydirma)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(baslangic)
      d.setDate(baslangic.getDate() + i)
      return d
    })
  }, [yil, ay])

  return (
    <>
      <section className="card cal-grid-card">
        <div className="cal-weekdays">
          {HAFTA_GUNLERI.map((g, i) => (
            <span key={g} className="cal-weekday" data-haftasonu={i >= 5}>
              {g}
            </span>
          ))}
        </div>
        <div className="cal-grid">
          {gunler.map((d) => {
            const iso = dateToIsoDate(d)
            const ogeler = ogeHaritasi?.get(iso) ?? []
            return (
              <button
                key={iso}
                type="button"
                className="cal-day"
                data-baskaAy={d.getMonth() !== ay}
                data-bugun={iso === bugun}
                data-secili={iso === secili}
                onClick={() => onSec(iso)}
                aria-label={`${tamTarih(iso)}, ${ogeler.length} kayıt`}
                aria-pressed={iso === secili}
              >
                <span className="cal-day-num">{d.getDate()}</span>
                <span className="cal-dots" aria-hidden="true">
                  {ogeler.slice(0, 3).map((oge) => (
                    <span
                      key={`${oge.kaynak}-${oge.id}`}
                      className={`cal-dot accent-${oge.accent}`}
                    />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <GunKarti
        gun={secili}
        ogeler={ogeHaritasi?.get(secili)}
        yukleniyor={ogeHaritasi === undefined}
      />
    </>
  )
}

/* ------------------------------------------------------------------ *
 * Hafta görünümü
 *
 * Telefonda saat ızgarası okunmuyor; onun yerine yedi günlük şerit ve
 * seçilen günün listesi gösteriliyor.
 * ------------------------------------------------------------------ */

function HaftaGorunumu({
  secili,
  onSec,
}: {
  secili: IsoDate
  onSec: (gun: IsoDate) => void
}) {
  const ogeHaritasi = useHaftaOgeleri(secili)
  const bugun = bugunIso()
  const { bas } = haftaSinirlari(secili)

  const gunler = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(bas)
    d.setDate(bas.getDate() + i)
    return d
  })

  return (
    <>
      <section className="card">
        <div className="cal-strip">
          {gunler.map((d, i) => {
            const iso = dateToIsoDate(d)
            const ogeler = ogeHaritasi?.get(iso) ?? []
            return (
              <button
                key={iso}
                type="button"
                className="cal-strip-day"
                data-secili={iso === secili}
                data-bugun={iso === bugun}
                onClick={() => onSec(iso)}
                aria-label={`${tamTarih(iso)}, ${ogeler.length} kayıt`}
                aria-pressed={iso === secili}
              >
                <span className="cal-strip-label">{HAFTA_GUNLERI[i]}</span>
                <span className="cal-strip-num">{d.getDate()}</span>
                <span className="cal-dots" aria-hidden="true">
                  {ogeler.slice(0, 3).map((oge) => (
                    <span
                      key={`${oge.kaynak}-${oge.id}`}
                      className={`cal-dot accent-${oge.accent}`}
                    />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <GunKarti
        gun={secili}
        ogeler={ogeHaritasi?.get(secili)}
        yukleniyor={ogeHaritasi === undefined}
      />
    </>
  )
}

function GunKarti({
  gun,
  ogeler,
  yukleniyor,
}: {
  gun: IsoDate
  ogeler: TakvimOgesi[] | undefined
  yukleniyor: boolean
}) {
  const adet = ogeler?.length ?? 0
  return (
    <section className="card section-card">
      <div className="cal-day-header">
        <div>
          <p className="t-label section-eyebrow">{gunEtiketi(gun)}</p>
          <h2 className="t-title">{tamTarih(gun)}</h2>
        </div>
        {!yukleniyor ? (
          <span className="cal-day-count">
            {adet === 0 ? 'boş' : `${adet} kayıt`}
          </span>
        ) : null}
      </div>
      {yukleniyor ? <SatirIskeleti adet={2} /> : <GunListesi ogeler={ogeler ?? []} />}
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Ajanda
 * ------------------------------------------------------------------ */

function AjandaGorunumu() {
  const gruplar = useAjanda(45)

  if (gruplar === undefined) {
    return (
      <section className="card section-card">
        <SatirIskeleti adet={4} />
      </section>
    )
  }

  if (gruplar.length === 0) {
    return (
      <section className="card section-card">
        <div className="cal-day-header">
          <div>
            <p className="t-label section-eyebrow">Önümüzdeki 45 gün</p>
            <h2 className="t-title">Ajanda</h2>
          </div>
        </div>
        <p className="section-empty">
          Önümüzdeki 45 gün için planlanmış bir kayıt yok.
        </p>
      </section>
    )
  }

  return (
    <section className="card section-card">
      {gruplar.map((grup) => (
        <div key={grup.gun} className="agenda-group">
          <p className="agenda-date">
            <span className="agenda-date-gun">{tamTarih(grup.gun)}</span>
            <span className="agenda-date-alt">{gunEtiketi(grup.gun)}</span>
          </p>
          <GunListesi ogeler={grup.ogeler} />
        </div>
      ))}
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Sayfa
 * ------------------------------------------------------------------ */

export function Takvim() {
  const [gorunum, setGorunum] = useState<Gorunum>('ay')
  const [secili, setSecili] = useState<IsoDate>(bugunIso())
  const [ankraj, setAnkraj] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const ayKaydir = (yon: -1 | 1) => {
    setAnkraj((mevcut) => {
      const yeni = new Date(mevcut.getFullYear(), mevcut.getMonth() + yon, 1)
      return yeni
    })
  }

  const haftaKaydir = (yon: -1 | 1) => {
    const d = isoDateToDate(secili)
    d.setDate(d.getDate() + yon * 7)
    setSecili(dateToIsoDate(d))
  }

  const buguneDon = () => {
    const bugun = new Date()
    setSecili(dateToIsoDate(bugun))
    setAnkraj(new Date(bugun.getFullYear(), bugun.getMonth(), 1))
  }

  const baslik =
    gorunum === 'hafta'
      ? format(haftaSinirlari(secili).bas, 'MMMM yyyy', { locale: tr })
      : format(ankraj, 'MMMM yyyy', { locale: tr })

  return (
    <>
      <div className="cal-head">
        <h1 className="t-title cal-month">
          {gorunum === 'ajanda' ? 'Ajanda' : baslik}
        </h1>
        {gorunum !== 'ajanda' ? (
          <div className="cal-nav">
            <button type="button" className="cal-today" onClick={buguneDon}>
              Bugün
            </button>
            <button
              type="button"
              className="cal-nav-button"
              onClick={() => (gorunum === 'ay' ? ayKaydir(-1) : haftaKaydir(-1))}
            >
              <Icon
                name="chevron-right"
                size={17}
                title="Önceki"
                style={{ transform: 'rotate(180deg)' }}
              />
            </button>
            <button
              type="button"
              className="cal-nav-button"
              onClick={() => (gorunum === 'ay' ? ayKaydir(1) : haftaKaydir(1))}
            >
              <Icon name="chevron-right" size={17} title="Sonraki" />
            </button>
          </div>
        ) : null}
      </div>

      <div className="cal-tabs" role="tablist" aria-label="Takvim görünümü">
        {(
          [
            ['ay', 'Ay'],
            ['hafta', 'Hafta'],
            ['ajanda', 'Ajanda'],
          ] as const
        ).map(([deger, etiket]) => (
          <button
            key={deger}
            type="button"
            role="tab"
            className="cal-tab"
            aria-selected={gorunum === deger}
            onClick={() => setGorunum(deger)}
          >
            {etiket}
          </button>
        ))}
      </div>

      {gorunum === 'ay' ? (
        <AyGorunumu
          ankraj={ankraj}
          secili={secili}
          onSec={(gun) => {
            setSecili(gun)
            const d = isoDateToDate(gun)
            // Başka aya ait bir güne dokunulduysa ızgara o aya kaysın.
            if (d.getMonth() !== ankraj.getMonth()) {
              setAnkraj(new Date(d.getFullYear(), d.getMonth(), 1))
            }
          }}
        />
      ) : null}

      {gorunum === 'hafta' ? (
        <HaftaGorunumu secili={secili} onSec={setSecili} />
      ) : null}

      {gorunum === 'ajanda' ? <AjandaGorunumu /> : null}

      <p className="t-small t-muted" style={{ padding: '0 var(--space-1)' }}>
        Süre kayıtları bilgilendirme amaçlıdır; son günün doğruluğunu teyit
        etmek kullanıcının sorumluluğundadır.
      </p>

      <Link to={`/takvim/yeni?gun=${secili}`} className="fab">
        <Icon name="plus" size={18} />
        Ekle
      </Link>
      <div className="fab-spacer" aria-hidden="true" />
    </>
  )
}
