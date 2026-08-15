import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { Link, useNavigate } from '../router'
import {
  muvekkilEkle,
  muvekkilGuncelle,
  muvekkilSilVeyaArsivle,
  useMuvekkil,
  type MuvekkilGirdisi,
} from '../data/muvekkilIslemleri'
import type { MuvekkilTuru } from '../domain/types'

interface Durum {
  ad: string
  tur: MuvekkilTuru
  kimlikNo: string
  telefon: string
  eposta: string
  adres: string
  etiketler: string
  not: string
}

function bosDurum(): Durum {
  return {
    ad: '',
    tur: 'gercek',
    kimlikNo: '',
    telefon: '',
    eposta: '',
    adres: '',
    etiketler: '',
    not: '',
  }
}

export function MuvekkilForm({ id }: { id?: string }) {
  const navigate = useNavigate()
  const duzenleme = id !== undefined
  const mevcut = useMuvekkil(id)

  const [durum, setDurum] = useState<Durum>(bosDurum)
  const [hata, setHata] = useState<string | null>(null)
  const [silmeOnayi, setSilmeOnayi] = useState(false)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [yuklendi, setYuklendi] = useState(!duzenleme)

  useEffect(() => {
    if (!duzenleme || !mevcut || yuklendi) return
    setDurum({
      ad: mevcut.ad,
      tur: mevcut.tur,
      kimlikNo: mevcut.kimlikNo ?? '',
      telefon: mevcut.telefon ?? '',
      eposta: mevcut.eposta ?? '',
      adres: mevcut.adres ?? '',
      etiketler: mevcut.etiketler.join(', '),
      not: mevcut.not ?? '',
    })
    setYuklendi(true)
  }, [duzenleme, mevcut, yuklendi])

  const guncelle = <K extends keyof Durum>(alan: K, deger: Durum[K]) => {
    setDurum((o) => ({ ...o, [alan]: deger }))
    setHata(null)
  }

  const kaydet = async () => {
    if (!durum.ad.trim()) {
      setHata('Ad girilmeli.')
      return
    }
    const girdi: MuvekkilGirdisi = {
      ad: durum.ad,
      tur: durum.tur,
      kimlikNo: durum.kimlikNo,
      telefon: durum.telefon,
      eposta: durum.eposta,
      adres: durum.adres,
      etiketler: durum.etiketler
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean),
      not: durum.not,
    }
    // Çift dokunuşta iki müvekkil oluşmasın diye kayıt uçarken kilitle.
    setKaydediliyor(true)
    try {
      if (duzenleme && id) {
        await muvekkilGuncelle(id, girdi)
        navigate(`/muvekkiller/${id}`)
      } else {
        const yeniId = await muvekkilEkle(girdi)
        navigate(`/muvekkiller/${yeniId}`)
      }
    } finally {
      setKaydediliyor(false)
    }
  }

  const sil = async () => {
    if (!id) return
    const sonuc = await muvekkilSilVeyaArsivle(id)
    // Arşivlendiyse profile dön (veri duruyor), silindiyse listeye.
    navigate(sonuc === 'silindi' ? '/muvekkiller' : `/muvekkiller/${id}`)
  }

  if (duzenleme && mevcut === null) {
    return (
      <section className="card placeholder">
        <div className="placeholder-body">
          <p className="t-label placeholder-crumb">Müvekkiller</p>
          <h1 className="t-display placeholder-title">Müvekkil bulunamadı.</h1>
          <Link to="/muvekkiller" className="placeholder-link">
            Listeye dön
            <Icon name="arrow-up-right" size={15} />
          </Link>
        </div>
      </section>
    )
  }

  const geriYol = duzenleme ? `/muvekkiller/${id}` : '/muvekkiller'

  return (
    <>
      <Link to={geriYol} className="page-back">
        <Icon name="arrow-left" size={17} />
        {duzenleme ? 'Profile dön' : 'Müvekkillere dön'}
      </Link>

      <div className="form-head">
        <p className="t-label">
          {duzenleme ? 'Müvekkili düzenle' : 'Yeni müvekkil'}
        </p>
        <h1 className="t-title">{duzenleme ? durum.ad || 'Müvekkil' : 'Müvekkil ekle'}</h1>
      </div>

      <section className="card form-card">
        <label className="field">
          <span className="field-label">Ad / Unvan</span>
          <input
            className="input"
            value={durum.ad}
            placeholder="Seda Yılmaz"
            onChange={(e) => guncelle('ad', e.target.value)}
          />
        </label>

        <div className="field">
          <span className="field-label">Tür</span>
          <div className="type-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {(['gercek', 'tuzel'] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`type-chip accent-${t === 'tuzel' ? 'purple' : 'blue'}`}
                aria-pressed={durum.tur === t}
                onClick={() => guncelle('tur', t)}
              >
                <Icon
                  name={t === 'tuzel' ? 'folder' : 'users'}
                  size={17}
                  className="type-chip-icon"
                />
                {t === 'tuzel' ? 'Tüzel kişi' : 'Gerçek kişi'}
              </button>
            ))}
          </div>
        </div>

        <div className="field-row">
          <label className="field">
            <span className="field-label">Telefon</span>
            <input
              type="tel"
              className="input"
              value={durum.telefon}
              placeholder="0532 000 00 00"
              onChange={(e) => guncelle('telefon', e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">
              {durum.tur === 'tuzel' ? 'Vergi no' : 'TC kimlik'}
            </span>
            <input
              className="input"
              inputMode="numeric"
              value={durum.kimlikNo}
              onChange={(e) => guncelle('kimlikNo', e.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span className="field-label">E-posta</span>
          <input
            type="email"
            className="input"
            value={durum.eposta}
            placeholder="ornek@eposta.com"
            onChange={(e) => guncelle('eposta', e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">Adres</span>
          <textarea
            className="textarea"
            value={durum.adres}
            onChange={(e) => guncelle('adres', e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">Etiketler</span>
          <input
            className="input"
            value={durum.etiketler}
            placeholder="kurumsal, öncelikli"
            onChange={(e) => guncelle('etiketler', e.target.value)}
          />
          <span className="field-hint">Virgülle ayırın.</span>
        </label>

        {hata ? <p className="field-error" role="alert">{hata}</p> : null}

        <div className="form-actions">
          <button
            type="button"
            className="button-primary"
            disabled={kaydediliyor}
            onClick={() => void kaydet()}
          >
            {duzenleme ? 'Değişikliği kaydet' : 'Müvekkili ekle'}
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
            Bağlı dosyası varsa müvekkil arşivlenir (veri korunur); yoksa kalıcı
            olarak silinir.{' '}
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
