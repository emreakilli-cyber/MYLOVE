import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Icon } from '../components/Icon'
import { SatirIskeleti } from '../components/BolumKarti'
import { Link } from '../router'
import {
  dosyaDurumEtiketleri,
  dosyaTuruEtiketleri,
  finansOzeti,
  useDosyaDetayi,
  type DosyaDetayi as Detay,
} from '../data/dosyaSorgulari'
import { gorevDurumunuDegistir } from '../data/sorgular'
import {
  kisiEkle,
  kisiRolEtiketleri,
  kisiSil,
  notEkle,
  notSil,
} from '../data/dosyaIslemleri'
import { sureDurumDegistir, sureSil } from '../data/sureIslemleri'
import {
  belgeEtiketleriGuncelle,
  belgeSil,
  belgeYukle,
} from '../data/belgeIslemleri'
import { BelgeOnizleme } from '../components/BelgeOnizleme'
import { olayGorunumleri } from '../domain/olay'
import { seviyeMetni } from '../domain/hazirlik'
import { tutarTam } from '../domain/para'
import {
  aciliyet,
  goreliZaman,
  kalanSureMetni,
  kisaTarih,
  saat,
  tamTarih,
  tarihRozeti,
} from '../domain/tarih'
import type { Belge, HazirlikOzeti, KisiRolu } from '../domain/types'

type Sekme =
  | 'genel'
  | 'durusmalar'
  | 'sureler'
  | 'gorevler'
  | 'belgeler'
  | 'finans'
  | 'notlar'

const seviyeAksani: Record<HazirlikOzeti['seviye'], string> = {
  iyi: 'green',
  orta: 'purple',
  dikkat: 'amber',
}

const kategoriEtiketleri: Record<string, string> = {
  harc: 'Harç',
  'gider-avansi': 'Gider avansı',
  bilirkisi: 'Bilirkişi',
  kesif: 'Keşif',
  teblig: 'Tebligat',
  arabuluculuk: 'Arabuluculuk',
  noter: 'Noter',
  'icra-masrafi': 'İcra masrafı',
  'muvekkil-avansi': 'Müvekkil avansı',
  'vekalet-ucreti': 'Vekâlet ücreti',
  diger: 'Diğer',
}

const belgeTuruEtiketleri: Record<Belge['tur'], string> = {
  vekaletname: 'Vekâletname',
  dilekce: 'Dilekçe',
  karar: 'Karar',
  'bilirkisi-raporu': 'Bilirkişi raporu',
  dekont: 'Dekont',
  makbuz: 'Makbuz',
  sozlesme: 'Sözleşme',
  kimlik: 'Kimlik',
  foto: 'Fotoğraf',
  ses: 'Ses kaydı',
  diger: 'Diğer',
}

function boyutMetni(bayt: number): string {
  if (bayt < 1024) return `${bayt} B`
  if (bayt < 1024 * 1024) return `${Math.round(bayt / 1024)} KB`
  return `${(bayt / (1024 * 1024)).toFixed(1)} MB`
}

/* ------------------------------------------------------------------ *
 * Sekme içerikleri
 * ------------------------------------------------------------------ */

function GenelSekmesi({ detay }: { detay: Detay }) {
  const { dosya, muvekkil, ozet } = detay
  const alanlar: Array<[string, string | undefined]> = [
    ['Müvekkil', muvekkil?.ad],
    ['Karşı taraf', dosya.karsiTaraf],
    ['Mahkeme', dosya.mahkeme],
    ['Esas no', dosya.esasNo],
    ['Karar no', dosya.kararNo],
    ['Konu', dosya.konu],
    ['Açılış', tamTarih(dosya.acilisTarihi)],
    ['Kapanış', dosya.kapanisTarihi ? tamTarih(dosya.kapanisTarihi) : undefined],
  ]

  return (
    <>
      <section className="card">
        <div className="info-grid">
          {alanlar.map(([etiket, deger]) => (
            <span className="info-item" key={etiket}>
              <span className="info-label">{etiket}</span>
              <span className="info-value" data-bos={!deger}>
                {deger ?? '—'}
              </span>
            </span>
          ))}
        </div>
      </section>

      <section className="card section-card">
        <div className="section-head">
          <div>
            <p className="t-label section-eyebrow">Dosya sağlığı</p>
            <h2 className="t-title">Hazırlık kontrolü</h2>
          </div>
        </div>
        <div className="divide-rows">
          {ozet.maddeler.map((madde) => (
            <div className="check-item" key={madde.anahtar} data-tamam={madde.tamam}>
              <span className="check-mark" data-tamam={madde.tamam}>
                <Icon name={madde.tamam ? 'check' : 'close'} size={12} />
              </span>
              <span className="check-text">
                <span className="check-label">
                  {madde.tamam ? madde.etiket : madde.etiketEksik ?? madde.etiket}
                </span>
                {!madde.tamam && madde.eylem ? (
                  <span className="check-action">{madde.eylem}</span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function DurusmaSekmesi({ detay }: { detay: Detay }) {
  if (detay.olaylar.length === 0) {
    return <BosKart mesaj="Bu dosyada takvim kaydı yok." />
  }
  return (
    <section className="card divide-rows">
      {detay.olaylar.map((olay) => {
        const gorunum = olayGorunumleri[olay.tur]
        const rozet = tarihRozeti(olay.baslangic)
        return (
          <Link
            key={olay.id}
            to={`/takvim/olay/${olay.id}`}
            className={`row accent-${gorunum.accent}`}
          >
            <span className="date-badge" aria-hidden="true">
              <span className="date-badge-day">{rozet.gun}</span>
              <span className="date-badge-month">{rozet.ay}</span>
            </span>
            <span className="row-main">
              <span className="row-title truncate">{olay.baslik}</span>
              <span className="row-sub truncate">{gorunum.etiket}</span>
              {olay.yer ? (
                <span className="event-meta">
                  <Icon name="map-pin" size={13} />
                  <span className="truncate">{olay.yer}</span>
                </span>
              ) : null}
            </span>
            <span className="event-time">
              <Icon name="clock" size={13} />
              {olay.tumGun ? 'gün' : saat(olay.baslangic)}
            </span>
          </Link>
        )
      })}
    </section>
  )
}

function SureSekmesi({ detay }: { detay: Detay }) {
  return (
    <>
      <Link to={`/sure?dosya=${detay.dosya.id}`} className="tab-action">
        <Icon name="plus" size={16} />
        Süre hesapla
      </Link>

      {detay.sureler.length === 0 ? (
        <BosKart mesaj="Bu dosyada kayıtlı hukuki süre yok." />
      ) : (
        <section className="card divide-rows">
          {detay.sureler.map((sure) => (
            <div
              key={sure.id}
              className={`row accent-${
                sure.durum === 'tamamlandi'
                  ? 'green'
                  : aciliyet(sure.sonTarih) === 'normal'
                    ? 'blue'
                    : aciliyet(sure.sonTarih) === 'yakin'
                      ? 'amber'
                      : 'red'
              }`}
            >
              <button
                type="button"
                className="task-check"
                data-tamam={sure.durum === 'tamamlandi'}
                aria-pressed={sure.durum === 'tamamlandi'}
                aria-label={`${sure.kuralAdi} — ${
                  sure.durum === 'tamamlandi' ? 'geri al' : 'tamamlandı işaretle'
                }`}
                onClick={() =>
                  void sureDurumDegistir(
                    sure.id,
                    sure.durum === 'tamamlandi' ? 'acik' : 'tamamlandi',
                  )
                }
              >
                <Icon name="check" size={13} />
              </button>
              <span className="row-main">
                <span className="row-title truncate">{sure.kuralAdi}</span>
                <span className="row-sub truncate">
                  {sure.kanunReferansi} · {tamTarih(sure.sonTarih)}
                </span>
              </span>
              <span className="deadline-kalan">
                {sure.durum === 'tamamlandi'
                  ? 'tamamlandı'
                  : kalanSureMetni(sure.sonTarih)}
              </span>
              <button
                type="button"
                className="row-remove"
                onClick={() => void sureSil(sure.id)}
                aria-label={`${sure.kuralAdi} süresini sil`}
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
        </section>
      )}

      <p className="t-small t-muted" style={{ padding: '0 var(--space-1)' }}>
        Süre hesapları bilgilendirme amaçlıdır; son günün doğruluğunu teyit
        etmek kullanıcının sorumluluğundadır.
      </p>
    </>
  )
}

function GorevSekmesi({ detay }: { detay: Detay }) {
  if (detay.gorevler.length === 0) {
    return <BosKart mesaj="Bu dosyada görev yok." />
  }
  return (
    <section className="card divide-rows">
      {detay.gorevler.map((gorev) => {
        const tamam = gorev.durum === 'tamamlandi'
        return (
          <div key={gorev.id} className="row accent-slate" data-tamam={tamam}>
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
            <span className="row-main">
              <span className="row-title truncate">{gorev.baslik}</span>
              {gorev.vadeTarihi ? (
                <span className="row-sub">
                  {kisaTarih(gorev.vadeTarihi)}
                  {gorev.oncelik === 'yuksek' ? ' · öncelikli' : ''}
                </span>
              ) : null}
            </span>
          </div>
        )
      })}
    </section>
  )
}

function BelgeSekmesi({ detay }: { detay: Detay }) {
  const girisRef = useRef<HTMLInputElement>(null)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)
  const [onizlenen, setOnizlenen] = useState<Belge | null>(null)

  const yukle = async (dosya: File | undefined) => {
    if (!dosya) return
    setYukleniyor(true)
    setHata(null)
    try {
      await belgeYukle({ dosya, dosyaId: detay.dosya.id })
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Belge yüklenemedi.')
    } finally {
      setYukleniyor(false)
      if (girisRef.current) girisRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={girisRef}
        type="file"
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,audio/*"
        style={{ display: 'none' }}
        onChange={(e) => void yukle(e.target.files?.[0])}
      />
      <button
        type="button"
        className="tab-action"
        disabled={yukleniyor}
        onClick={() => girisRef.current?.click()}
      >
        <Icon name="plus" size={16} />
        {yukleniyor ? 'Yükleniyor…' : 'Belge yükle'}
      </button>

      {hata ? (
        <p className="field-error" style={{ padding: '0 var(--space-1)' }}>
          {hata}
        </p>
      ) : null}

      {detay.belgeler.length === 0 ? (
        <BosKart mesaj="Bu dosyaya henüz belge eklenmemiş." />
      ) : (
        <section className="card divide-rows">
          {detay.belgeler.map((belge) => (
            <div key={belge.id} className="belge-satir accent-blue">
              <div className="belge-satir-ust">
                <button
                  type="button"
                  className="row-tile"
                  aria-label={`${belge.ad} önizle`}
                  onClick={() => setOnizlenen(belge)}
                >
                  <Icon name="folder" size={18} />
                </button>
                <button
                  type="button"
                  className="row-main belge-ac"
                  onClick={() => setOnizlenen(belge)}
                >
                  <span className="row-title truncate">{belge.ad}</span>
                  <span className="row-sub truncate">
                    {belgeTuruEtiketleri[belge.tur]} · {boyutMetni(belge.boyut)}{' '}
                    · {goreliZaman(belge.olusturmaTarihi)}
                  </span>
                </button>
                <button
                  type="button"
                  className="row-remove"
                  onClick={() => void belgeSil(belge.id)}
                  aria-label="Belgeyi sil"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
              <BelgeEtiketEditor belge={belge} />
            </div>
          ))}
        </section>
      )}

      {onizlenen ? (
        <BelgeOnizleme belge={onizlenen} onKapat={() => setOnizlenen(null)} />
      ) : null}
    </>
  )
}

/** Bir belgenin etiketlerini satır içinde düzenler (ekle/sil). */
function BelgeEtiketEditor({ belge }: { belge: Belge }) {
  const [yeni, setYeni] = useState('')

  const ekle = () => {
    const t = yeni.trim()
    if (!t) return
    void belgeEtiketleriGuncelle(belge.id, [...belge.etiketler, t])
    setYeni('')
  }

  const sil = (etiket: string) => {
    void belgeEtiketleriGuncelle(
      belge.id,
      belge.etiketler.filter((e) => e !== etiket),
    )
  }

  return (
    <div className="belge-etiketler">
      {belge.etiketler.map((e) => (
        <span key={e} className="tag tag-quiet belge-etiket">
          {e}
          <button
            type="button"
            className="belge-etiket-sil"
            onClick={() => sil(e)}
            aria-label={`${e} etiketini kaldır`}
          >
            <Icon name="close" size={12} />
          </button>
        </span>
      ))}
      <input
        className="belge-etiket-giris"
        value={yeni}
        onChange={(evt) => setYeni(evt.target.value)}
        onKeyDown={(evt) => {
          if (evt.key === 'Enter') {
            evt.preventDefault()
            ekle()
          }
        }}
        placeholder="+ etiket"
        aria-label={`${belge.ad} için etiket ekle`}
        maxLength={24}
      />
    </div>
  )
}

function FinansSekmesi({ detay }: { detay: Detay }) {
  const ozet = finansOzeti(detay.finans)
  return (
    <>
      <section className="card">
        <div className="money-grid">
          <div className="money-cell accent-green">
            <span className="money-label">Tahsil edilen</span>
            <span className="money-value">{tutarTam(ozet.gelir)}</span>
          </div>
          <div className="money-cell accent-red">
            <span className="money-label">Yapılan gider</span>
            <span className="money-value">{tutarTam(ozet.gider)}</span>
          </div>
          <div className="money-cell accent-purple">
            <span className="money-label">Bakiye</span>
            <span className="money-value">{tutarTam(ozet.bakiye)}</span>
          </div>
          <div className="money-cell accent-amber">
            <span className="money-label">Bekleyen ödeme</span>
            <span className="money-value">{tutarTam(ozet.bekleyen)}</span>
          </div>
        </div>
      </section>

      <Link
        to={`/finans/yeni?dosya=${detay.dosya.id}`}
        className="tab-action"
      >
        <Icon name="plus" size={16} />
        Finans kaydı ekle
      </Link>

      {detay.finans.length === 0 ? (
        <BosKart mesaj="Bu dosyada finans kaydı yok." />
      ) : (
        <section className="card divide-rows">
          {detay.finans.map((kayit) => (
            <Link
              key={kayit.id}
              to={`/finans/${kayit.id}`}
              className={`row accent-${
                kayit.odemeDurumu !== 'odendi'
                  ? 'amber'
                  : kayit.yon === 'gelir'
                    ? 'green'
                    : 'slate'
              }`}
            >
              <span className="row-tile" aria-hidden="true">
                <Icon name="wallet" size={18} />
              </span>
              <span className="row-main">
                <span className="row-title truncate">{kayit.baslik}</span>
                <span className="row-sub truncate">
                  {kategoriEtiketleri[kayit.kategori] ?? kayit.kategori} ·{' '}
                  {kisaTarih(kayit.tarih)}
                  {kayit.odemeDurumu !== 'odendi' ? ' · bekliyor' : ''}
                </span>
              </span>
              <span className="money-amount">
                {kayit.yon === 'gelir' ? '+' : '−'}
                {tutarTam(kayit.tutar)}
              </span>
            </Link>
          ))}
        </section>
      )}
    </>
  )
}

const kisiRolSirasi: KisiRolu[] = [
  'karsi-taraf',
  'karsi-vekil',
  'hakim',
  'bilirkisi',
  'tanik',
  'arabulucu',
  'icra-muduru',
  'diger',
]

function NotSekmesi({ detay }: { detay: Detay }) {
  const { notlar, kisiler, dosya } = detay
  const [notMetni, setNotMetni] = useState('')
  const [kisiFormu, setKisiFormu] = useState(false)
  const [kisiAdi, setKisiAdi] = useState('')
  const [kisiRol, setKisiRol] = useState<KisiRolu>('karsi-taraf')

  const notKaydet = async () => {
    if (!notMetni.trim()) return
    await notEkle(dosya.id, notMetni)
    setNotMetni('')
  }

  const kisiKaydet = async () => {
    if (!kisiAdi.trim()) return
    await kisiEkle(dosya.id, kisiAdi, kisiRol)
    setKisiAdi('')
    setKisiFormu(false)
  }

  return (
    <>
      <section className="card section-card">
        <div className="section-head">
          <div>
            <p className="t-label section-eyebrow">Dosyada</p>
            <h2 className="t-title">İlgili kişiler</h2>
          </div>
          <button
            type="button"
            className="section-link"
            onClick={() => setKisiFormu((a) => !a)}
          >
            {kisiFormu ? 'Vazgeç' : 'Ekle'}
            <Icon name={kisiFormu ? 'close' : 'plus'} size={14} />
          </button>
        </div>

        {kisiFormu ? (
          <div className="inline-form">
            <input
              className="input"
              value={kisiAdi}
              placeholder="Kişi adı"
              onChange={(e) => setKisiAdi(e.target.value)}
            />
            <select
              className="select"
              value={kisiRol}
              onChange={(e) => setKisiRol(e.target.value as KisiRolu)}
            >
              {kisiRolSirasi.map((r) => (
                <option key={r} value={r}>
                  {kisiRolEtiketleri[r]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="button-primary"
              onClick={() => void kisiKaydet()}
            >
              Kişiyi ekle
            </button>
          </div>
        ) : null}

        {kisiler.length > 0 ? (
          <div className="divide-rows">
            {kisiler.map((kisi) => (
              <div key={kisi.id} className="row accent-slate">
                <span className="row-tile" aria-hidden="true">
                  <Icon name="users" size={18} />
                </span>
                <span className="row-main">
                  <span className="row-title truncate">{kisi.ad}</span>
                  <span className="row-sub truncate">
                    {kisiRolEtiketleri[kisi.rol]}
                  </span>
                </span>
                <button
                  type="button"
                  className="row-remove"
                  onClick={() => void kisiSil(kisi.id)}
                  aria-label={`${kisi.ad} kaydını sil`}
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : !kisiFormu ? (
          <p className="section-empty">Henüz ilgili kişi eklenmemiş.</p>
        ) : null}
      </section>

      <section className="card section-card">
        <div className="section-head">
          <div>
            <p className="t-label section-eyebrow">Dosyada</p>
            <h2 className="t-title">Notlar</h2>
          </div>
        </div>

        <div className="inline-form">
          <textarea
            className="textarea"
            value={notMetni}
            placeholder="Görüşme özeti, hazırlık notu…"
            onChange={(e) => setNotMetni(e.target.value)}
          />
          <button
            type="button"
            className="button-primary"
            onClick={() => void notKaydet()}
            disabled={!notMetni.trim()}
          >
            Not ekle
          </button>
        </div>

        {notlar.length > 0 ? (
          <div className="divide-rows">
            {notlar.map((not) => (
              <div key={not.id} className="row accent-purple">
                <span className="row-tile" aria-hidden="true">
                  <Icon name="sparkles" size={18} />
                </span>
                <span className="row-main">
                  {not.baslik ? (
                    <span className="row-title">{not.baslik}</span>
                  ) : null}
                  <span className="row-sub">{not.icerik}</span>
                  <span className="row-sub t-muted">
                    {goreliZaman(not.olusturmaTarihi)}
                  </span>
                </span>
                <button
                  type="button"
                  className="row-remove"
                  onClick={() => void notSil(not.id)}
                  aria-label="Notu sil"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="section-empty">Bu dosyada not yok.</p>
        )}
      </section>
    </>
  )
}

function BosKart({ mesaj }: { mesaj: string }) {
  return (
    <section className="card section-card">
      <p className="section-empty">{mesaj}</p>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Sayfa
 * ------------------------------------------------------------------ */

export function DosyaDetay({ id }: { id?: string }) {
  const detay = useDosyaDetayi(id)
  const [sekme, setSekme] = useState<Sekme>('genel')

  if (detay === undefined) {
    return (
      <section className="card section-card">
        <SatirIskeleti adet={4} />
      </section>
    )
  }

  if (detay === null) {
    return (
      <section className="card placeholder">
        <div className="placeholder-body">
          <p className="t-label placeholder-crumb">Dosyalar</p>
          <h1 className="t-display placeholder-title">Dosya bulunamadı.</h1>
          <p className="t-body placeholder-text">
            Bu dosya silinmiş ya da bağlantı eskimiş olabilir.
          </p>
          <Link to="/dosyalar" className="placeholder-link">
            Dosya listesine dön
            <Icon name="arrow-up-right" size={15} />
          </Link>
        </div>
      </section>
    )
  }

  const { dosya, muvekkil, ozet } = detay
  const accent = seviyeAksani[ozet.seviye]

  const sekmeler: Array<[Sekme, string, number | null]> = [
    ['genel', 'Genel', null],
    ['durusmalar', 'Duruşmalar', detay.olaylar.length],
    ['sureler', 'Süreler', detay.sureler.length],
    ['gorevler', 'Görevler', detay.gorevler.length],
    ['belgeler', 'Belgeler', detay.belgeler.length],
    ['finans', 'Finans', detay.finans.length],
    ['notlar', 'Notlar', detay.notlar.length + detay.kisiler.length],
  ]

  // ARIA tabs klavye deseni: ok tuşları sekmeler arasında gezer (otomatik
  // etkinleştirme), Home/End ilk/son sekmeye gider. Roving tabindex ile yalnızca
  // seçili sekme Tab sırasında; okla geçince odak yeni sekmeye taşınır.
  const sekmeKlavye = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const yonler: Record<string, number | 'ilk' | 'son'> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      Home: 'ilk',
      End: 'son',
    }
    const yon = yonler[e.key]
    if (yon === undefined) return
    e.preventDefault()
    const n = sekmeler.length
    const i = sekmeler.findIndex(([d]) => d === sekme)
    const hedefIdx =
      yon === 'ilk' ? 0 : yon === 'son' ? n - 1 : (i + yon + n) % n
    const hedef = sekmeler[hedefIdx]
    if (!hedef) return
    setSekme(hedef[0])
    document.getElementById(`sekme-${hedef[0]}`)?.focus()
  }

  return (
    <>
      <div className="detail-topline">
        <Link to="/dosyalar" className="page-back">
          <Icon name="arrow-left" size={17} />
          Dosyalara dön
        </Link>
        <Link to={`/dosyalar/${dosya.id}/duzenle`} className="detail-edit">
          <Icon name="settings" size={15} />
          Düzenle
        </Link>
      </div>

      <section className={`card detail-hero accent-${accent}`}>
        <p className="t-label">{dosyaTuruEtiketleri[dosya.tur]} dosyası</p>
        <h1 className="t-title detail-title">{dosya.baslik}</h1>
        <p className="detail-sub">
          {[muvekkil?.ad, dosya.mahkeme].filter(Boolean).join(' · ')}
        </p>

        <div className="detail-tags">
          <span className="tag tag-quiet">
            {dosyaDurumEtiketleri[dosya.durum]}
          </span>
          {dosya.esasNo ? (
            <span className="tag tag-quiet">{dosya.esasNo}</span>
          ) : null}
          {/* Konu buraya çip olarak konmuyor: uzun bir cümle (ör. "İşçilik
              alacağı, kıdem ve ihbar tazminatı…") nowrap/uppercase/mono çipte
              hem yatay taşma yapıyor hem görsel dile aykırı. Konu zaten
              aşağıdaki bilgi ızgarasında ("Konu" alanı) düzgün gösteriliyor. */}
        </div>

        <div className="detail-progress">
          <div className="detail-progress-head">
            <span>{seviyeMetni(ozet.seviye)}</span>
            <span className="detail-progress-value">%{ozet.yuzde}</span>
          </div>
          <div
            className="health-bar"
            role="progressbar"
            aria-valuenow={ozet.yuzde}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Hazırlık durumu"
          >
            <div className="health-bar-fill" style={{ width: `${ozet.yuzde}%` }} />
          </div>
          {ozet.sonrakiAdim ? (
            <p className="t-small" style={{ marginTop: 'var(--space-2)' }}>
              Sıradaki adım: {ozet.sonrakiAdim}
            </p>
          ) : null}
        </div>
      </section>

      <div
        className="tab-row"
        role="tablist"
        aria-label="Dosya bölümleri"
        onKeyDown={sekmeKlavye}
      >
        {sekmeler.map(([deger, etiket, adet]) => (
          <button
            key={deger}
            type="button"
            role="tab"
            id={`sekme-${deger}`}
            aria-controls={`panel-${deger}`}
            className="tab"
            aria-selected={sekme === deger}
            tabIndex={sekme === deger ? 0 : -1}
            onClick={() => setSekme(deger)}
          >
            {etiket}
            {adet !== null ? <span className="tab-count">{adet}</span> : null}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panel-${sekme}`}
        aria-labelledby={`sekme-${sekme}`}
        tabIndex={0}
      >
        {sekme === 'genel' ? <GenelSekmesi detay={detay} /> : null}
        {sekme === 'durusmalar' ? <DurusmaSekmesi detay={detay} /> : null}
        {sekme === 'sureler' ? <SureSekmesi detay={detay} /> : null}
        {sekme === 'gorevler' ? <GorevSekmesi detay={detay} /> : null}
        {sekme === 'belgeler' ? <BelgeSekmesi detay={detay} /> : null}
        {sekme === 'finans' ? <FinansSekmesi detay={detay} /> : null}
        {sekme === 'notlar' ? <NotSekmesi detay={detay} /> : null}
      </div>
    </>
  )
}
