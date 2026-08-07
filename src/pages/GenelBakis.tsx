import { useState } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { BolumKarti, SatirIskeleti } from '../components/BolumKarti'
import { Link } from '../router'
import {
  gorevDurumunuDegistir,
  useAyarlar,
  useGunlukGorevler,
  useHazirlikDurumlari,
  useIstatistikler,
  useSonHareketler,
  useYaklasanOlaylar,
  useYaklasanSureler,
  type GorevSatiri,
  type HazirlikSatiri,
  type OlaySatiri,
  type PanelIstatistikleri,
  type SureSatiri,
} from '../data/sorgular'
import { gorevEkle } from '../data/gorevIslemleri'
import { seviyeMetni } from '../domain/hazirlik'
import { tutarKisa, yuzdeDegisim, yuzdeMetni } from '../domain/para'
import {
  aciliyet,
  goreliZaman,
  gunFarki,
  hitap,
  kalanSureMetni,
  kisaTarih,
  saat,
  selamlama,
  tarihRozeti,
  uzunTarihEtiketi,
} from '../domain/tarih'
import type {
  HareketTuru,
  HazirlikOzeti,
  OlayTuru,
  Hareket,
} from '../domain/types'

type Accent = 'red' | 'amber' | 'purple' | 'blue' | 'green' | 'slate'

const olayAksani: Record<OlayTuru, Accent> = {
  durusma: 'red',
  'muvekkil-gorusmesi': 'blue',
  kesif: 'green',
  icra: 'purple',
  arabuluculuk: 'amber',
  'dilekce-teslimi': 'amber',
  'son-tarih': 'red',
  diger: 'slate',
}

const hareketGorunumu: Record<HareketTuru, { icon: IconName; accent: Accent }> =
  {
    'belge-yuklendi': { icon: 'folder', accent: 'blue' },
    'gorev-tamamlandi': { icon: 'check', accent: 'green' },
    'hatirlatma-gonderildi': { icon: 'bell', accent: 'amber' },
    'not-eklendi': { icon: 'sparkles', accent: 'purple' },
    'odeme-kaydedildi': { icon: 'wallet', accent: 'purple' },
    'sure-hesaplandi': { icon: 'calendar-clock', accent: 'red' },
    'olay-eklendi': { icon: 'calendar', accent: 'blue' },
    'dosya-olusturuldu': { icon: 'folder', accent: 'slate' },
    'muvekkil-eklendi': { icon: 'users', accent: 'green' },
  }

const seviyeAksani: Record<HazirlikOzeti['seviye'], Accent> = {
  iyi: 'green',
  orta: 'purple',
  dikkat: 'amber',
}

/* ------------------------------------------------------------------ *
 * Hero
 * ------------------------------------------------------------------ */

function Hero({ ad, onYenile }: { ad: string; onYenile: () => void }) {
  const [yenileniyor, setYenileniyor] = useState(false)

  return (
    <section className="card hero" data-tur="panel">
      <div className="hero-ring hero-ring-1" aria-hidden="true" />
      <div className="hero-ring hero-ring-2" aria-hidden="true" />
      <div className="hero-body">
        <p className="t-label hero-date">{uzunTarihEtiketi()}</p>
        <h1 className="t-display hero-greeting">
          {selamlama()}, {hitap(ad)}
        </h1>
        <p className="t-body hero-text">
          İyi bir gün için önce bugün neyin önemli olduğuna bakalım.
        </p>
        <button
          type="button"
          className="hero-button"
          data-yenileniyor={yenileniyor}
          onClick={() => {
            setYenileniyor(true)
            onYenile()
            window.setTimeout(() => setYenileniyor(false), 700)
          }}
        >
          <Icon name="refresh" size={15} />
          Güncelle
        </button>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * İstatistikler
 * ------------------------------------------------------------------ */

function StatKarti({
  etiket,
  deger,
  alt,
  accent,
}: {
  etiket: string
  deger: string
  alt: string
  accent: Accent
}) {
  return (
    <div className={`card stat-card accent-${accent}`}>
      <div className="stat-head">
        <span className="stat-label">{etiket}</span>
        <span className="stat-dot" aria-hidden="true" />
      </div>
      <span className="stat-value">{deger}</span>
      <span className="stat-caption">{alt}</span>
    </div>
  )
}

function StatIzgarasi({ veri }: { veri: PanelIstatistikleri | undefined }) {
  if (!veri) {
    return (
      <div className="stat-grid">
        {Array.from({ length: 4 }, (_, i) => (
          <div className="card stat-card" key={i}>
            <div className="skeleton" style={{ width: '70%', height: 12 }} />
            <div
              className="skeleton"
              style={{ width: '45%', height: 26, marginTop: 10 }}
            />
            <div
              className="skeleton"
              style={{ width: '55%', height: 11, marginTop: 8 }}
            />
          </div>
        ))}
      </div>
    )
  }

  const degisim = yuzdeDegisim(veri.buAyTahsilat, veri.gecenAyTahsilat)

  return (
    <div className="stat-grid">
      <StatKarti
        etiket="Aktif dosya"
        deger={String(veri.aktifDosya)}
        alt={
          veri.buAyAcilanDosya > 0 ? `+${veri.buAyAcilanDosya} bu ay` : 'bu ay yeni yok'
        }
        accent="blue"
      />
      <StatKarti
        etiket="Bu haftaki duruşma"
        deger={String(veri.buHaftakiDurusma)}
        alt={veri.bugunkuDurusma > 0 ? `${veri.bugunkuDurusma} bugün` : 'bugün yok'}
        accent="amber"
      />
      <StatKarti
        etiket="Bekleyen görev"
        deger={String(veri.bekleyenGorev)}
        alt={
          veri.oncelikliGorev > 0
            ? `${veri.oncelikliGorev} öncelikli`
            : 'öncelikli yok'
        }
        accent="green"
      />
      <StatKarti
        etiket="Bu ay tahsilat"
        deger={tutarKisa(veri.buAyTahsilat)}
        alt={yuzdeMetni(degisim)}
        accent="purple"
      />
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Yaklaşan son tarihler
 * ------------------------------------------------------------------ */

const aciliyetAksani: Record<ReturnType<typeof aciliyet>, Accent> = {
  gecti: 'red',
  kritik: 'red',
  yakin: 'amber',
  normal: 'blue',
}

function SureListesi({ satirlar }: { satirlar: SureSatiri[] | undefined }) {
  if (!satirlar) return <SatirIskeleti />

  return (
    <div className="divide-rows">
      {satirlar.map(({ sure, dosya }) => {
        const accent = aciliyetAksani[aciliyet(sure.sonTarih)]
        return (
          <Link
            key={sure.id}
            to={`/dosyalar/${sure.dosyaId}`}
            className={`row accent-${accent}`}
          >
            <span className="row-tile" aria-hidden="true">
              <Icon name="calendar-clock" size={19} />
            </span>
            <span className="row-main">
              <span className="row-title truncate">{sure.kuralAdi}</span>
              <span className="row-sub truncate">
                {dosya?.baslik ?? 'Dosya yok'}
                {dosya?.konu ? ` — ${dosya.konu}` : ''} ·{' '}
                {kisaTarih(sure.sonTarih)}
              </span>
            </span>
            <span className="row-aside">
              <span className="deadline-kalan">
                {kalanSureMetni(sure.sonTarih)}
              </span>
              <Icon name="chevron-right" size={16} className="row-chevron" />
            </span>
          </Link>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Bugünün programı
 * ------------------------------------------------------------------ */

function OlayListesi({ satirlar }: { satirlar: OlaySatiri[] | undefined }) {
  if (!satirlar) return <SatirIskeleti />

  return (
    <div className="divide-rows">
      {satirlar.map(({ olay, dosya }) => {
        const rozet = tarihRozeti(olay.baslangic)
        const accent = olayAksani[olay.tur]
        return (
          <Link
            key={olay.id}
            to={olay.dosyaId ? `/dosyalar/${olay.dosyaId}` : '/takvim'}
            className={`row accent-${accent}`}
          >
            <span className="date-badge" aria-hidden="true">
              <span className="date-badge-day">{rozet.gun}</span>
              <span className="date-badge-month">{rozet.ay}</span>
            </span>
            <span className="row-main">
              <span className="row-title truncate">{olay.baslik}</span>
              <span className="row-sub truncate">{dosya?.baslik ?? ''}</span>
              {olay.yer ? (
                <span className="event-meta">
                  <Icon name="map-pin" size={13} />
                  <span className="truncate">{olay.yer}</span>
                </span>
              ) : null}
            </span>
            <span className="event-time">
              <Icon name="clock" size={13} />
              {saat(olay.baslangic)}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Bugün yapılacaklar
 * ------------------------------------------------------------------ */

function vadeRozeti(vade: string | undefined): {
  metin: string
  accent: Accent
} | null {
  if (!vade) return null
  const fark = gunFarki(vade)
  if (fark < 0) return { metin: 'gecikti', accent: 'red' }
  if (fark === 0) return { metin: 'bugün', accent: 'red' }
  if (fark === 1) return { metin: 'yarın', accent: 'amber' }
  return { metin: kisaTarih(vade), accent: 'slate' }
}

function GorevListesi({ satirlar }: { satirlar: GorevSatiri[] | undefined }) {
  if (!satirlar) return <SatirIskeleti />

  return (
    <>
      <div className="divide-rows">
        {satirlar.map(({ gorev, dosya }) => {
          const tamam = gorev.durum === 'tamamlandi'
          const rozet = vadeRozeti(gorev.vadeTarihi)
          return (
            <div
              key={gorev.id}
              className={`row accent-${rozet?.accent ?? 'slate'}`}
              data-tamam={tamam}
            >
              <button
                type="button"
                className="task-check"
                data-tamam={tamam}
                aria-pressed={tamam}
                aria-label={
                  tamam
                    ? `${gorev.baslik} — tamamlandı, geri al`
                    : `${gorev.baslik} — tamamlandı olarak işaretle`
                }
                onClick={() => void gorevDurumunuDegistir(gorev)}
              >
                <Icon name="check" size={13} />
              </button>
              <span className="row-main">
                <span className="row-title truncate">{gorev.baslik}</span>
                <span className="row-sub truncate">{dosya?.baslik ?? ''}</span>
              </span>
              {rozet ? (
                <span className="task-badge">{rozet.metin}</span>
              ) : null}
            </div>
          )
        })}
      </div>

      <HizliGorevEkle />
    </>
  )
}

/** Panelden ayrılmadan hızlı görev ekleme; detay için forma bağlantı verir. */
function HizliGorevEkle() {
  const [acik, setAcik] = useState(false)
  const [metin, setMetin] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  const ekle = async () => {
    const baslik = metin.trim()
    if (!baslik || kaydediliyor) return
    setKaydediliyor(true)
    try {
      await gorevEkle({ baslik, oncelik: 'normal' })
      setMetin('')
    } finally {
      setKaydediliyor(false)
    }
  }

  if (!acik) {
    return (
      <button
        type="button"
        className="task-add"
        onClick={() => setAcik(true)}
      >
        <Icon name="plus" size={16} />
        Yeni görev ekle
      </button>
    )
  }

  return (
    <div className="task-add-form">
      <input
        className="input task-add-input"
        value={metin}
        placeholder="Görev başlığı…"
        aria-label="Yeni görev başlığı"
        autoFocus
        onChange={(e) => setMetin(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void ekle()
          if (e.key === 'Escape') {
            setMetin('')
            setAcik(false)
          }
        }}
      />
      <button
        type="button"
        className="button-primary task-add-btn"
        disabled={!metin.trim() || kaydediliyor}
        onClick={() => void ekle()}
      >
        Ekle
      </button>
      <Link to="/gorevler/yeni" className="task-add-detay">
        Detaylı
      </Link>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Hazırlık durumu
 * ------------------------------------------------------------------ */

function HazirlikListesi({
  satirlar,
}: {
  satirlar: HazirlikSatiri[] | undefined
}) {
  if (!satirlar) return <SatirIskeleti />

  return (
    <div className="divide-rows">
      {satirlar.map(({ dosya, muvekkil, ozet, durumNotu }) => (
        <Link
          key={dosya.id}
          to={`/dosyalar/${dosya.id}`}
          className={`health-row accent-${seviyeAksani[ozet.seviye]}`}
        >
          <span className="health-head">
            <span className="health-name truncate">{dosya.baslik}</span>
            <span className="health-percent">%{ozet.yuzde}</span>
          </span>
          <span className="health-sub truncate">
            {[muvekkil?.ad, dosya.mahkeme].filter(Boolean).join(' · ')}
          </span>
          <span
            className="health-bar"
            role="progressbar"
            aria-valuenow={ozet.yuzde}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${dosya.baslik} hazırlık durumu`}
          >
            <span
              className="health-bar-fill"
              style={{ width: `${ozet.yuzde}%` }}
            />
          </span>
          <span className="health-foot">
            <span className="health-next truncate">{durumNotu}</span>
            <span className="health-level">{seviyeMetni(ozet.seviye)}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Son hareketler
 * ------------------------------------------------------------------ */

function HareketListesi({ satirlar }: { satirlar: Hareket[] | undefined }) {
  if (!satirlar) return <SatirIskeleti />

  return (
    <div className="divide-rows">
      {satirlar.map((hareket) => {
        const gorunum = hareketGorunumu[hareket.tur]
        return (
          <div key={hareket.id} className={`row accent-${gorunum.accent}`}>
            <span className="row-tile" aria-hidden="true">
              <Icon name={gorunum.icon} size={18} />
            </span>
            <span className="row-main">
              <span className="row-title truncate">{hareket.baslik}</span>
              {hareket.ayrinti ? (
                <span className="row-sub truncate">{hareket.ayrinti}</span>
              ) : null}
            </span>
            <span className="deadline-kalan" style={{ color: 'var(--text-muted)' }}>
              {goreliZaman(hareket.zaman)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Sayfa
 * ------------------------------------------------------------------ */

export function GenelBakis() {
  // "Güncelle" bölümleri yeniden bağlar: tarihe dayalı hesaplar (bugün, kalan
  // gün) uygulama gece yarısını aşarak açık kaldığında tazelensin.
  const [tazelik, setTazelik] = useState(0)
  const ayarlar = useAyarlar()

  return (
    <>
      <Hero
        ad={ayarlar?.kullaniciAdi ?? 'Meslektaşım'}
        onYenile={() => setTazelik((n) => n + 1)}
      />
      <PanelIcerigi key={tazelik} />
    </>
  )
}

function PanelIcerigi() {
  const istatistikler = useIstatistikler()
  const sureler = useYaklasanSureler(3)
  const olaylar = useYaklasanOlaylar(3, 4)
  const gorevler = useGunlukGorevler(5)
  const hazirlik = useHazirlikDurumlari(3)
  const hareketler = useSonHareketler(4)

  return (
    <>
      <StatIzgarasi veri={istatistikler} />

      <BolumKarti
        etiket="Takipte kalın"
        baslik="Yaklaşan son tarihler"
        hepsiYolu="/takvim"
        bos={sureler?.length === 0}
        bosMesaj="Şu an açık bir hukuki süre yok."
      >
        <SureListesi satirlar={sureler} />
      </BolumKarti>

      <BolumKarti
        etiket="Bugünün programı"
        baslik="Duruşmalar"
        hepsiYolu="/takvim"
        bos={olaylar?.length === 0}
        bosMesaj="Önümüzdeki üç günde planlanmış bir işlem yok."
      >
        <OlayListesi satirlar={olaylar} />
      </BolumKarti>

      <BolumKarti
        etiket="İş listesi"
        baslik="Bugün yapılacaklar"
        hepsiYolu="/gorevler"
        bos={gorevler?.length === 0}
        bosMesaj="Bekleyen görev yok."
      >
        <GorevListesi satirlar={gorevler} />
      </BolumKarti>

      <BolumKarti
        etiket="Dosya sağlığı"
        baslik="Hazırlık durumu"
        hepsiYolu="/dosyalar"
        bos={hazirlik?.length === 0}
        bosMesaj="Henüz açık dosya yok."
      >
        <HazirlikListesi satirlar={hazirlik} />
      </BolumKarti>

      <BolumKarti
        etiket="İz bırakın"
        baslik="Son hareketler"
        bos={hareketler?.length === 0}
        bosMesaj="Henüz bir hareket kaydedilmedi."
      >
        <HareketListesi satirlar={hareketler} />
      </BolumKarti>

      <GuvenlikKarti />
    </>
  )
}

function GuvenlikKarti() {
  return (
    <section className="card safety-card">
      <div className="safety-ring" aria-hidden="true" />
      <div className="safety-body">
        <Icon name="shield" size={24} className="safety-icon" />
        <h2 className="t-title safety-title">
          Dosyalarınız güvende, odağınız sizde.
        </h2>
        <p className="safety-text">
          JurisCalendar, kritik tarihleri ve iş akışınızı tek bir sakin ekranda
          tutar. Müvekkil verisi bu cihazdan dışarı çıkmaz.
        </p>
        <Link to="/ayarlar" className="safety-link">
          Çalışma alanını yönet
          <Icon name="arrow-up-right" size={15} />
        </Link>
      </div>
    </section>
  )
}
