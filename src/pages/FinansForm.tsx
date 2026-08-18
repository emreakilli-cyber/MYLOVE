import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { Link, useLocation, useNavigate } from '../router'
import { useFormHata } from '../hooks/useFormHata'
import {
  finansEkle,
  finansGuncelle,
  finansSil,
  kategoriEtiketleri,
  kategoriYonu,
  useFinansKaydi,
  type FinansGirdisi,
} from '../data/finansIslemleri'
import {
  belgeSil,
  belgeYukle,
  belgeyiIndir,
  boyutMetni,
  useFinansBelgeleri,
} from '../data/belgeIslemleri'
import { useAcikDosyalar } from '../data/olayIslemleri'
import { bugunIso, tamTarih } from '../domain/tarih'
import { metindenKurus, tutarDuzenlenebilir, tutarTam } from '../domain/para'
import type { FinansKategorisi, FinansYonu } from '../domain/types'

const kategoriSirasi: FinansKategorisi[] = [
  'harc',
  'gider-avansi',
  'bilirkisi',
  'kesif',
  'teblig',
  'arabuluculuk',
  'noter',
  'icra-masrafi',
  'muvekkil-avansi',
  'vekalet-ucreti',
  'diger',
]

interface Durum {
  dosyaId: string
  kategori: FinansKategorisi
  yon: FinansYonu
  baslik: string
  tutarMetni: string
  odenenMetni: string
  odemeDurumu: 'bekliyor' | 'odendi' | 'kismi'
  tarih: string
  vadeTarihi: string
  aciklama: string
}

function bosDurum(dosyaId: string): Durum {
  return {
    dosyaId,
    kategori: 'harc',
    yon: 'gider',
    baslik: '',
    tutarMetni: '',
    odenenMetni: '',
    odemeDurumu: 'bekliyor',
    tarih: bugunIso(),
    vadeTarihi: '',
    aciklama: '',
  }
}

export function FinansForm({ id }: { id?: string }) {
  const navigate = useNavigate()
  const { query } = useLocation()
  const duzenleme = id !== undefined
  const mevcut = useFinansKaydi(id)
  const dosyalar = useAcikDosyalar()
  const belgeler = useFinansBelgeleri(id)
  const dosyaGirisRef = useRef<HTMLInputElement>(null)

  const [durum, setDurum] = useState<Durum>(() =>
    bosDurum(query.get('dosya') ?? ''),
  )
  const { hata, basarisiz, temizle, alanHatasi, setHata } = useFormHata()
  const [silmeOnayi, setSilmeOnayi] = useState(false)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [yuklendi, setYuklendi] = useState(!duzenleme)
  const [yukleniyor, setYukleniyor] = useState(false)

  useEffect(() => {
    if (!duzenleme || !mevcut || yuklendi) return
    setDurum({
      dosyaId: mevcut.dosyaId,
      kategori: mevcut.kategori,
      yon: mevcut.yon,
      baslik: mevcut.baslik,
      tutarMetni: tutarDuzenlenebilir(mevcut.tutar),
      odenenMetni:
        mevcut.odenenTutar > 0 ? tutarDuzenlenebilir(mevcut.odenenTutar) : '',
      odemeDurumu: mevcut.odemeDurumu,
      tarih: mevcut.tarih,
      vadeTarihi: mevcut.vadeTarihi ?? '',
      aciklama: mevcut.aciklama ?? '',
    })
    setYuklendi(true)
  }, [duzenleme, mevcut, yuklendi])

  const guncelle = <K extends keyof Durum>(alan: K, deger: Durum[K]) => {
    setDurum((o) => ({ ...o, [alan]: deger }))
    temizle()
  }

  const kategoriSec = (kategori: FinansKategorisi) => {
    setDurum((o) => ({ ...o, kategori, yon: kategoriYonu[kategori] }))
  }

  const kaydet = async () => {
    const tutar = metindenKurus(durum.tutarMetni)
    if (!durum.baslik.trim()) {
      basarisiz('baslik', 'Başlık girilmeli.')
      return
    }
    if (tutar === null || tutar <= 0) {
      basarisiz('tutarMetni', 'Geçerli bir tutar girilmeli.')
      return
    }
    if (!durum.dosyaId) {
      basarisiz('dosyaId', 'Dosya seçilmeli.')
      return
    }

    // Ödeme durumundan ödenen tutarı türet; "kısmi"de girilen değeri kullan.
    let odenen = 0
    if (durum.odemeDurumu === 'odendi') odenen = tutar
    else if (durum.odemeDurumu === 'kismi') {
      odenen = metindenKurus(durum.odenenMetni) ?? 0
    }

    const girdi: FinansGirdisi = {
      dosyaId: durum.dosyaId,
      yon: durum.yon,
      kategori: durum.kategori,
      baslik: durum.baslik,
      tutar,
      odenenTutar: odenen,
      tarih: durum.tarih,
      vadeTarihi: durum.vadeTarihi || undefined,
      odemeDurumu: durum.odemeDurumu,
      aciklama: durum.aciklama,
    }

    // Çift dokunuşta iki finans kaydı oluşmasın diye kayıt uçarken kilitle.
    setKaydediliyor(true)
    try {
      if (duzenleme && id) {
        await finansGuncelle(id, girdi)
        navigate(`/finans/${id}`)
      } else {
        const yeniId = await finansEkle(girdi)
        navigate(`/finans/${yeniId}`)
      }
    } finally {
      setKaydediliyor(false)
    }
  }

  const sil = async () => {
    if (!id) return
    await finansSil(id)
    navigate('/finans')
  }

  const dekontYukle = async (dosya: File | undefined) => {
    if (!dosya || !id) return
    setYukleniyor(true)
    temizle()
    try {
      await belgeYukle({
        dosya,
        tur: dosya.type.startsWith('image/') ? 'dekont' : 'makbuz',
        finansKaydiId: id,
        ...(durum.dosyaId ? { dosyaId: durum.dosyaId } : {}),
      })
    } catch (e) {
      setHata(e instanceof Error ? e.message : 'Belge yüklenemedi.')
    } finally {
      setYukleniyor(false)
      if (dosyaGirisRef.current) dosyaGirisRef.current.value = ''
    }
  }

  if (duzenleme && mevcut === null) {
    return (
      <section className="card placeholder">
        <div className="placeholder-body">
          <p className="t-label placeholder-crumb">Finans</p>
          <h1 className="t-display placeholder-title">Kayıt bulunamadı.</h1>
          <Link to="/finans" className="placeholder-link">
            Finansa dön
            <Icon name="arrow-up-right" size={15} />
          </Link>
        </div>
      </section>
    )
  }

  const onizlemeTutar = metindenKurus(durum.tutarMetni)

  return (
    <>
      <Link to="/finans" className="page-back">
        <Icon name="arrow-left" size={17} />
        Finansa dön
      </Link>

      <div className="form-head">
        <p className="t-label">{duzenleme ? 'Kaydı düzenle' : 'Yeni kayıt'}</p>
        <h1 className="t-title">
          {duzenleme ? durum.baslik || 'Finans kaydı' : 'Finans kaydı'}
        </h1>
      </div>

      <section className="card form-card">
        <label className="field">
          <span className="field-label">Kategori</span>
          <select
            className="select"
            value={durum.kategori}
            onChange={(e) => kategoriSec(e.target.value as FinansKategorisi)}
          >
            {kategoriSirasi.map((k) => (
              <option key={k} value={k}>
                {kategoriEtiketleri[k]}
                {kategoriYonu[k] === 'gelir' ? ' (gelir)' : ' (gider)'}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Başlık</span>
          <input
            id="alan-baslik"
            className="input"
            value={durum.baslik}
            placeholder={kategoriEtiketleri[durum.kategori]}
            onChange={(e) => guncelle('baslik', e.target.value)}
            {...alanHatasi('baslik')}
          />
        </label>

        <label className="field">
          <span className="field-label">Dosya</span>
          <select
            id="alan-dosyaId"
            className="select"
            value={durum.dosyaId}
            onChange={(e) => guncelle('dosyaId', e.target.value)}
            {...alanHatasi('dosyaId')}
          >
            <option value="" disabled>
              Dosya seçin
            </option>
            {(dosyalar ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.baslik}
                {d.esasNo ? ` — ${d.esasNo}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Tutar</span>
          <input
            id="alan-tutarMetni"
            className="input"
            inputMode="decimal"
            value={durum.tutarMetni}
            placeholder="1.250,00"
            onChange={(e) => guncelle('tutarMetni', e.target.value)}
            {...alanHatasi('tutarMetni')}
          />
          {onizlemeTutar !== null && onizlemeTutar > 0 ? (
            <span className="field-hint">{tutarTam(onizlemeTutar)}</span>
          ) : null}
        </label>

        <div className="field">
          <span className="field-label">Ödeme durumu</span>
          <div className="type-grid type-grid-3">
            {(
              [
                ['bekliyor', 'Bekliyor', 'amber'],
                ['kismi', 'Kısmi', 'blue'],
                ['odendi', 'Ödendi', 'green'],
              ] as const
            ).map(([deger, etiket, renk]) => (
              <button
                key={deger}
                type="button"
                className={`type-chip accent-${renk}`}
                aria-pressed={durum.odemeDurumu === deger}
                onClick={() => guncelle('odemeDurumu', deger)}
              >
                {etiket}
              </button>
            ))}
          </div>
        </div>

        {durum.odemeDurumu === 'kismi' ? (
          <label className="field">
            <span className="field-label">Ödenen tutar</span>
            <input
              className="input"
              inputMode="decimal"
              value={durum.odenenMetni}
              placeholder="500,00"
              onChange={(e) => guncelle('odenenMetni', e.target.value)}
            />
          </label>
        ) : null}

        <div className="field-row">
          <label className="field">
            <span className="field-label">İşlem tarihi</span>
            <input
              type="date"
              className="input"
              value={durum.tarih}
              onChange={(e) => guncelle('tarih', e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Vade (bekleyen)</span>
            <input
              type="date"
              className="input"
              value={durum.vadeTarihi}
              onChange={(e) => guncelle('vadeTarihi', e.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span className="field-label">Açıklama</span>
          <textarea
            className="textarea"
            value={durum.aciklama}
            onChange={(e) => guncelle('aciklama', e.target.value)}
          />
        </label>

        {hata ? <p className="field-error" role="alert">{hata}</p> : null}

        <div className="form-actions">
          <button
            type="button"
            className="button-primary"
            disabled={kaydediliyor}
            onClick={() => void kaydet()}
          >
            {duzenleme ? 'Değişikliği kaydet' : 'Kaydı ekle'}
          </button>
          {duzenleme ? (
            <button
              type="button"
              className="button-danger"
              onClick={() => (silmeOnayi ? void sil() : setSilmeOnayi(true))}
            >
              {silmeOnayi ? 'Emin misiniz?' : 'Sil'}
            </button>
          ) : null}
        </div>
      </section>

      {/* Dekont / makbuz arşivi — yalnızca kayıt oluşturulduktan sonra */}
      {duzenleme ? (
        <section className="card section-card">
          <div className="section-head">
            <div>
              <p className="t-label section-eyebrow">Arşiv</p>
              <h2 className="t-title">Dekont ve makbuzlar</h2>
            </div>
          </div>

          <div className="inline-form">
            <input
              ref={dosyaGirisRef}
              type="file"
              accept="image/*,application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => void dekontYukle(e.target.files?.[0])}
            />
            <button
              type="button"
              className="button-quiet"
              style={{ width: '100%' }}
              disabled={yukleniyor}
              onClick={() => dosyaGirisRef.current?.click()}
            >
              {yukleniyor ? 'Yükleniyor…' : '+ Dekont / makbuz yükle'}
            </button>
          </div>

          {belgeler && belgeler.length > 0 ? (
            <div className="divide-rows">
              {belgeler.map((belge) => (
                <div key={belge.id} className="row accent-blue">
                  <button
                    type="button"
                    className="row-tile"
                    aria-label={`${belge.ad} indir`}
                    onClick={() => belgeyiIndir(belge)}
                  >
                    <Icon name="folder" size={18} />
                  </button>
                  <span className="row-main">
                    <span className="row-title truncate">{belge.ad}</span>
                    <span className="row-sub truncate">
                      {boyutMetni(belge.boyut)}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="row-remove"
                    onClick={() => void belgeSil(belge.id)}
                    aria-label="Belgeyi sil"
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="section-empty">Henüz dekont eklenmemiş.</p>
          )}
        </section>
      ) : (
        <p className="t-small t-muted" style={{ padding: '0 var(--space-1)' }}>
          Dekont ve makbuzları kaydı oluşturduktan sonra ekleyebilirsiniz.
          İşlem tarihi: {tamTarih(durum.tarih)}
        </p>
      )}
    </>
  )
}
