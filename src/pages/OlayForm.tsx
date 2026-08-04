import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { Link, useLocation, useNavigate } from '../router'
import {
  olayEkle,
  olayGuncelle,
  olaySil,
  useAcikDosyalar,
  useOlay,
  type OlayGirdisi,
} from '../data/olayIslemleri'
import { olayGorunumleri, olayTurleri } from '../domain/olay'
import { bugunIso, dateToIsoDate, saat, tamTarih } from '../domain/tarih'
import type { OlayTuru } from '../domain/types'

/*
 * Olay oluşturma ve düzenleme.
 *
 * Tarih ve saat için tarayıcının kendi seçicileri kullanılıyor: iOS'ta yerel
 * tekerlek arayüzü çıkıyor, bizim yazacağımız her seçici ondan kötü olurdu.
 */

interface Durum extends OlayGirdisi {}

function bosDurum(gun: string): Durum {
  return {
    baslik: '',
    tur: 'durusma',
    gun,
    baslangicSaati: '09:30',
    bitisSaati: '',
    tumGun: false,
    yer: '',
    aciklama: '',
    dosyaId: '',
  }
}

export function OlayForm({ id }: { id?: string }) {
  const navigate = useNavigate()
  const { query } = useLocation()
  const duzenleme = id !== undefined
  const mevcut = useOlay(id)
  const dosyalar = useAcikDosyalar()

  const [durum, setDurum] = useState<Durum>(() =>
    bosDurum(query.get('gun') ?? bugunIso()),
  )
  const [hata, setHata] = useState<string | null>(null)
  const [silmeOnayi, setSilmeOnayi] = useState(false)
  const [yuklendi, setYuklendi] = useState(!duzenleme)

  // Düzenleme modunda kayıt gelince formu bir kez doldur.
  useEffect(() => {
    if (!duzenleme || !mevcut || yuklendi) return
    const baslangic = new Date(mevcut.baslangic)
    setDurum({
      baslik: mevcut.baslik,
      tur: mevcut.tur,
      dosyaId: mevcut.dosyaId ?? '',
      gun: dateToIsoDate(baslangic),
      baslangicSaati: mevcut.tumGun ? '09:00' : saat(baslangic),
      bitisSaati: mevcut.bitis ? saat(new Date(mevcut.bitis)) : '',
      tumGun: mevcut.tumGun,
      yer: mevcut.yer ?? '',
      aciklama: mevcut.aciklama ?? '',
    })
    setYuklendi(true)
  }, [duzenleme, mevcut, yuklendi])

  const guncelle = <K extends keyof Durum>(alan: K, deger: Durum[K]) => {
    setDurum((onceki) => ({ ...onceki, [alan]: deger }))
    setHata(null)
  }

  const turSec = (tur: OlayTuru) => {
    setDurum((onceki) => ({
      ...onceki,
      tur,
      // Başlık dokunulmamışsa tür adını başlık olarak öner.
      baslik:
        onceki.baslik === '' ||
        onceki.baslik === olayGorunumleri[onceki.tur].etiket
          ? olayGorunumleri[tur].etiket
          : onceki.baslik,
    }))
  }

  const kaydet = async () => {
    const baslik = durum.baslik.trim() || olayGorunumleri[durum.tur].etiket
    if (!durum.gun) {
      setHata('Tarih girilmeli.')
      return
    }
    if (
      !durum.tumGun &&
      durum.bitisSaati &&
      durum.baslangicSaati &&
      durum.bitisSaati < durum.baslangicSaati
    ) {
      setHata('Bitiş saati başlangıçtan önce olamaz.')
      return
    }

    const girdi: OlayGirdisi = { ...durum, baslik }
    if (duzenleme && id) await olayGuncelle(id, girdi)
    else await olayEkle(girdi)
    navigate('/takvim')
  }

  const sil = async () => {
    if (!id) return
    await olaySil(id)
    navigate('/takvim')
  }

  if (duzenleme && mevcut === null) {
    return (
      <section className="card placeholder">
        <div className="placeholder-body">
          <p className="t-label placeholder-crumb">Takvim</p>
          <h1 className="t-display placeholder-title">Kayıt bulunamadı.</h1>
          <p className="t-body placeholder-text">
            Bu kayıt silinmiş olabilir.
          </p>
          <Link to="/takvim" className="placeholder-link">
            Takvime dön
            <Icon name="arrow-up-right" size={15} />
          </Link>
        </div>
      </section>
    )
  }

  return (
    <>
      <Link to="/takvim" className="page-back">
        <Icon name="arrow-left" size={17} />
        Takvime dön
      </Link>

      <div className="form-head">
        <p className="t-label">{duzenleme ? 'Kaydı düzenle' : 'Yeni kayıt'}</p>
        <h1 className="t-title">
          {duzenleme ? durum.baslik || 'Kayıt' : 'Takvime ekle'}
        </h1>
      </div>

      <section className="card form-card">
        <div className="field">
          <span className="field-label">Tür</span>
          <div className="type-grid">
            {olayTurleri.map((tur) => {
              const gorunum = olayGorunumleri[tur]
              return (
                <button
                  key={tur}
                  type="button"
                  className={`type-chip accent-${gorunum.accent}`}
                  aria-pressed={durum.tur === tur}
                  onClick={() => turSec(tur)}
                >
                  <Icon
                    name={gorunum.icon}
                    size={17}
                    className="type-chip-icon"
                  />
                  {gorunum.etiket}
                </button>
              )
            })}
          </div>
        </div>

        <label className="field">
          <span className="field-label">Başlık</span>
          <input
            className="input"
            value={durum.baslik}
            placeholder={olayGorunumleri[durum.tur].etiket}
            onChange={(e) => guncelle('baslik', e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">Dosya</span>
          <select
            className="select"
            value={durum.dosyaId ?? ''}
            onChange={(e) => guncelle('dosyaId', e.target.value)}
          >
            <option value="">Dosyaya bağlı değil</option>
            {(dosyalar ?? []).map((dosya) => (
              <option key={dosya.id} value={dosya.id}>
                {dosya.baslik}
                {dosya.esasNo ? ` — ${dosya.esasNo}` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Tarih</span>
          <input
            type="date"
            className="input"
            value={durum.gun}
            onChange={(e) => guncelle('gun', e.target.value)}
          />
          {durum.gun ? (
            <span className="field-hint">{tamTarih(durum.gun)}</span>
          ) : null}
        </label>

        <button
          type="button"
          className="switch-row"
          aria-pressed={durum.tumGun}
          onClick={() => guncelle('tumGun', !durum.tumGun)}
        >
          <span>
            <span style={{ display: 'block' }}>Tüm gün</span>
            <span className="field-hint">
              Saat belirtmeden gün boyu bir kayıt
            </span>
          </span>
          <span className="switch-track" aria-hidden="true">
            <span className="switch-thumb" />
          </span>
        </button>

        {!durum.tumGun ? (
          <div className="field-row">
            <label className="field">
              <span className="field-label">Başlangıç</span>
              <input
                type="time"
                className="input"
                value={durum.baslangicSaati ?? ''}
                onChange={(e) => guncelle('baslangicSaati', e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">Bitiş</span>
              <input
                type="time"
                className="input"
                value={durum.bitisSaati ?? ''}
                onChange={(e) => guncelle('bitisSaati', e.target.value)}
              />
            </label>
          </div>
        ) : null}

        <label className="field">
          <span className="field-label">Yer</span>
          <input
            className="input"
            value={durum.yer ?? ''}
            placeholder="İstanbul 14. İş Mahkemesi"
            onChange={(e) => guncelle('yer', e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">Not</span>
          <textarea
            className="textarea"
            value={durum.aciklama ?? ''}
            placeholder="Duruşmaya götürülecek belgeler, hazırlık notları…"
            onChange={(e) => guncelle('aciklama', e.target.value)}
          />
        </label>

        {hata ? <p className="field-error">{hata}</p> : null}

        <div className="form-actions">
          <button
            type="button"
            className="button-primary"
            onClick={() => void kaydet()}
          >
            {duzenleme ? 'Değişikliği kaydet' : 'Takvime ekle'}
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
            Kayıt kalıcı olarak silinecek.{' '}
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
