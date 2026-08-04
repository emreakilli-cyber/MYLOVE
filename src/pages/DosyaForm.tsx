import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { Link, useNavigate } from '../router'
import {
  dosyaEkle,
  dosyaGuncelle,
  dosyaSil,
  useDosya,
  useMuvekkiller,
  type DosyaGirdisi,
} from '../data/dosyaIslemleri'
import {
  dosyaDurumEtiketleri,
  dosyaTuruEtiketleri,
} from '../data/dosyaSorgulari'
import type { DosyaDurumu, DosyaTuru } from '../domain/types'

/*
 * Dosya oluşturma ve düzenleme. Müvekkil seçicide "Yeni müvekkil" seçeneği var:
 * dosya açarken müvekkil kaydı da yoksa aynı ekranda oluşturulabiliyor.
 */

const YENI_MUVEKKIL = '__yeni__'

const turSirasi: DosyaTuru[] = [
  'hukuk',
  'is',
  'ticaret',
  'ceza',
  'icra',
  'idari',
  'aile',
  'tuketici',
  'arabuluculuk',
  'diger',
]

const durumSirasi: DosyaDurumu[] = [
  'hazirlik',
  'derdest',
  'istinaf',
  'temyiz',
  'infaz',
  'kapali',
]

interface Durum {
  baslik: string
  muvekkilSecim: string
  yeniMuvekkilAdi: string
  tur: DosyaTuru
  durum: DosyaDurumu
  konu: string
  mahkeme: string
  esasNo: string
  karsiTaraf: string
  not: string
}

function bosDurum(): Durum {
  return {
    baslik: '',
    muvekkilSecim: '',
    yeniMuvekkilAdi: '',
    tur: 'hukuk',
    durum: 'hazirlik',
    konu: '',
    mahkeme: '',
    esasNo: '',
    karsiTaraf: '',
    not: '',
  }
}

export function DosyaForm({ id }: { id?: string }) {
  const navigate = useNavigate()
  const duzenleme = id !== undefined
  const mevcut = useDosya(id)
  const muvekkiller = useMuvekkiller()

  const [durum, setDurum] = useState<Durum>(bosDurum)
  const [hata, setHata] = useState<string | null>(null)
  const [silmeOnayi, setSilmeOnayi] = useState(false)
  const [yuklendi, setYuklendi] = useState(!duzenleme)

  useEffect(() => {
    if (!duzenleme || !mevcut || yuklendi) return
    setDurum({
      baslik: mevcut.baslik,
      muvekkilSecim: mevcut.muvekkilId,
      yeniMuvekkilAdi: '',
      tur: mevcut.tur,
      durum: mevcut.durum,
      konu: mevcut.konu ?? '',
      mahkeme: mevcut.mahkeme ?? '',
      esasNo: mevcut.esasNo ?? '',
      karsiTaraf: mevcut.karsiTaraf ?? '',
      not: mevcut.not ?? '',
    })
    setYuklendi(true)
  }, [duzenleme, mevcut, yuklendi])

  const guncelle = <K extends keyof Durum>(alan: K, deger: Durum[K]) => {
    setDurum((o) => ({ ...o, [alan]: deger }))
    setHata(null)
  }

  const yeniMuvekkilModu = durum.muvekkilSecim === YENI_MUVEKKIL

  const kaydet = async () => {
    if (!durum.baslik.trim()) {
      setHata('Dosya başlığı girilmeli.')
      return
    }
    if (yeniMuvekkilModu && !durum.yeniMuvekkilAdi.trim()) {
      setHata('Yeni müvekkilin adı girilmeli.')
      return
    }
    if (!yeniMuvekkilModu && !durum.muvekkilSecim) {
      setHata('Müvekkil seçilmeli.')
      return
    }

    const girdi: DosyaGirdisi = {
      baslik: durum.baslik,
      muvekkilId: yeniMuvekkilModu ? '' : durum.muvekkilSecim,
      ...(yeniMuvekkilModu ? { yeniMuvekkilAdi: durum.yeniMuvekkilAdi } : {}),
      tur: durum.tur,
      durum: durum.durum,
      konu: durum.konu,
      mahkeme: durum.mahkeme,
      esasNo: durum.esasNo,
      karsiTaraf: durum.karsiTaraf,
      not: durum.not,
    }

    if (duzenleme && id) {
      await dosyaGuncelle(id, girdi)
      navigate(`/dosyalar/${id}`)
    } else {
      const yeniId = await dosyaEkle(girdi)
      navigate(`/dosyalar/${yeniId}`)
    }
  }

  const sil = async () => {
    if (!id) return
    await dosyaSil(id)
    navigate('/dosyalar')
  }

  if (duzenleme && mevcut === null) {
    return (
      <section className="card placeholder">
        <div className="placeholder-body">
          <p className="t-label placeholder-crumb">Dosyalar</p>
          <h1 className="t-display placeholder-title">Dosya bulunamadı.</h1>
          <Link to="/dosyalar" className="placeholder-link">
            Dosya listesine dön
            <Icon name="arrow-up-right" size={15} />
          </Link>
        </div>
      </section>
    )
  }

  const geriYol = duzenleme ? `/dosyalar/${id}` : '/dosyalar'

  return (
    <>
      <Link to={geriYol} className="page-back">
        <Icon name="arrow-left" size={17} />
        {duzenleme ? 'Dosyaya dön' : 'Dosyalara dön'}
      </Link>

      <div className="form-head">
        <p className="t-label">{duzenleme ? 'Dosyayı düzenle' : 'Yeni dosya'}</p>
        <h1 className="t-title">
          {duzenleme ? durum.baslik || 'Dosya' : 'Dosya oluştur'}
        </h1>
      </div>

      <section className="card form-card">
        <label className="field">
          <span className="field-label">Dosya adı</span>
          <input
            className="input"
            value={durum.baslik}
            placeholder="Yılmaz / Arslan"
            onChange={(e) => guncelle('baslik', e.target.value)}
          />
          <span className="field-hint">
            Listede görünecek kısa ad. Genelde taraf adlarıyla yazılır.
          </span>
        </label>

        <label className="field">
          <span className="field-label">Müvekkil</span>
          <select
            className="select"
            value={durum.muvekkilSecim}
            onChange={(e) => guncelle('muvekkilSecim', e.target.value)}
          >
            <option value="" disabled>
              Müvekkil seçin
            </option>
            {(muvekkiller ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.ad}
              </option>
            ))}
            <option value={YENI_MUVEKKIL}>+ Yeni müvekkil ekle</option>
          </select>
        </label>

        {yeniMuvekkilModu ? (
          <label className="field">
            <span className="field-label">Yeni müvekkil adı</span>
            <input
              className="input"
              value={durum.yeniMuvekkilAdi}
              placeholder="Seda Yılmaz"
              onChange={(e) => guncelle('yeniMuvekkilAdi', e.target.value)}
            />
          </label>
        ) : null}

        <div className="field-row">
          <label className="field">
            <span className="field-label">Tür</span>
            <select
              className="select"
              value={durum.tur}
              onChange={(e) => guncelle('tur', e.target.value as DosyaTuru)}
            >
              {turSirasi.map((t) => (
                <option key={t} value={t}>
                  {dosyaTuruEtiketleri[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Durum</span>
            <select
              className="select"
              value={durum.durum}
              onChange={(e) => guncelle('durum', e.target.value as DosyaDurumu)}
            >
              {durumSirasi.map((d) => (
                <option key={d} value={d}>
                  {dosyaDurumEtiketleri[d]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span className="field-label">Konu</span>
          <input
            className="input"
            value={durum.konu}
            placeholder="İşçilik alacağı"
            onChange={(e) => guncelle('konu', e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">Mahkeme / İcra dairesi</span>
          <input
            className="input"
            value={durum.mahkeme}
            placeholder="İstanbul 14. İş Mahkemesi"
            onChange={(e) => guncelle('mahkeme', e.target.value)}
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field-label">Esas no</span>
            <input
              className="input"
              value={durum.esasNo}
              placeholder="2025/412 E."
              onChange={(e) => guncelle('esasNo', e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Karşı taraf</span>
            <input
              className="input"
              value={durum.karsiTaraf}
              placeholder="Arslan Metal Ltd."
              onChange={(e) => guncelle('karsiTaraf', e.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span className="field-label">Not</span>
          <textarea
            className="textarea"
            value={durum.not}
            placeholder="Dosyaya dair genel not…"
            onChange={(e) => guncelle('not', e.target.value)}
          />
        </label>

        {hata ? <p className="field-error">{hata}</p> : null}

        <div className="form-actions">
          <button
            type="button"
            className="button-primary"
            onClick={() => void kaydet()}
          >
            {duzenleme ? 'Değişikliği kaydet' : 'Dosyayı oluştur'}
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

        {silmeOnayi ? (
          <p className="field-hint">
            Dosya ve ona bağlı tüm duruşma, süre, görev, belge, finans ve not
            kayıtları kalıcı olarak silinecek.{' '}
            <button
              type="button"
              onClick={() => setSilmeOnayi(false)}
              style={{ color: 'var(--brand-teal)' }}
            >
              Vazgeç
            </button>
          </p>
        ) : null}
      </section>
    </>
  )
}
