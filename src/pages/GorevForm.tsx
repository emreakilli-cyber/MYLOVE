import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { Link, useLocation, useNavigate } from '../router'
import {
  gorevEkle,
  gorevGuncelle,
  gorevSablonlari,
  gorevSeriSil,
  gorevSil,
  oncelikEtiketleri,
  useGorev,
  useGorevSeriSayisi,
  useKullanicilar,
  type GorevGirdisi,
} from '../data/gorevIslemleri'
import { useAcikDosyalar } from '../data/olayIslemleri'
import { TekrarSecici, type TekrarSecim } from '../components/TekrarSecici'
import type { GorevOnceligi } from '../domain/types'

interface Durum {
  baslik: string
  dosyaId: string
  atananKullaniciId: string
  oncelik: GorevOnceligi
  vadeTarihi: string
  aciklama: string
}

function bosDurum(dosyaId: string): Durum {
  return {
    baslik: '',
    dosyaId,
    atananKullaniciId: '',
    oncelik: 'normal',
    vadeTarihi: '',
    aciklama: '',
  }
}

export function GorevForm({ id }: { id?: string }) {
  const navigate = useNavigate()
  const { query } = useLocation()
  const duzenleme = id !== undefined
  const mevcut = useGorev(id)
  const dosyalar = useAcikDosyalar()
  const kullanicilar = useKullanicilar()

  const [durum, setDurum] = useState<Durum>(() => bosDurum(query.get('dosya') ?? ''))
  const [hata, setHata] = useState<string | null>(null)
  const [silmeOnayi, setSilmeOnayi] = useState(false)
  const [yuklendi, setYuklendi] = useState(!duzenleme)
  const [tekrar, setTekrar] = useState<TekrarSecim>('yok')
  const [tekrarAdet, setTekrarAdet] = useState(8)
  const seriSayisi = useGorevSeriSayisi(mevcut?.seriesId)

  useEffect(() => {
    if (!duzenleme || !mevcut || yuklendi) return
    setDurum({
      baslik: mevcut.baslik,
      dosyaId: mevcut.dosyaId ?? '',
      atananKullaniciId: mevcut.atananKullaniciId ?? '',
      oncelik: mevcut.oncelik,
      vadeTarihi: mevcut.vadeTarihi ?? '',
      aciklama: mevcut.aciklama ?? '',
    })
    setYuklendi(true)
  }, [duzenleme, mevcut, yuklendi])

  const guncelle = <K extends keyof Durum>(alan: K, deger: Durum[K]) => {
    setDurum((o) => ({ ...o, [alan]: deger }))
    setHata(null)
  }

  const kaydet = async () => {
    if (!durum.baslik.trim()) {
      setHata('Görev başlığı girilmeli.')
      return
    }
    if (!duzenleme && tekrar !== 'yok' && !durum.vadeTarihi) {
      setHata('Tekrar eden görev için vade tarihi gerekli.')
      return
    }
    const girdi: GorevGirdisi = {
      baslik: durum.baslik,
      dosyaId: durum.dosyaId || undefined,
      atananKullaniciId: durum.atananKullaniciId || undefined,
      oncelik: durum.oncelik,
      vadeTarihi: durum.vadeTarihi || undefined,
      aciklama: durum.aciklama,
      ...(!duzenleme && tekrar !== 'yok' ? { tekrar, tekrarAdet } : {}),
    }
    if (duzenleme && id) await gorevGuncelle(id, girdi)
    else await gorevEkle(girdi)
    navigate('/gorevler')
  }

  const sil = async () => {
    if (!id) return
    await gorevSil(id)
    navigate('/gorevler')
  }

  const seriSil = async () => {
    if (!mevcut?.seriesId) return
    await gorevSeriSil(mevcut.seriesId)
    navigate('/gorevler')
  }

  if (duzenleme && mevcut === null) {
    return (
      <section className="card placeholder">
        <div className="placeholder-body">
          <p className="t-label placeholder-crumb">Görevler</p>
          <h1 className="t-display placeholder-title">Görev bulunamadı.</h1>
          <Link to="/gorevler" className="placeholder-link">
            Görevlere dön
            <Icon name="arrow-up-right" size={15} />
          </Link>
        </div>
      </section>
    )
  }

  return (
    <>
      <Link to="/gorevler" className="page-back">
        <Icon name="arrow-left" size={17} />
        Görevlere dön
      </Link>

      <div className="form-head">
        <p className="t-label">{duzenleme ? 'Görevi düzenle' : 'Yeni görev'}</p>
        <h1 className="t-title">
          {duzenleme ? durum.baslik || 'Görev' : 'Görev ekle'}
        </h1>
      </div>

      <section className="card form-card">
        <label className="field">
          <span className="field-label">Görev</span>
          <input
            className="input"
            value={durum.baslik}
            placeholder="Harç yatırılacak"
            onChange={(e) => guncelle('baslik', e.target.value)}
          />
        </label>

        {!duzenleme ? (
          <div className="field">
            <span className="field-label">Hazır şablonlar</span>
            <div className="chip-row" style={{ marginInline: 0, paddingInline: 0 }}>
              {gorevSablonlari.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="chip"
                  aria-pressed={durum.baslik === s}
                  onClick={() => guncelle('baslik', s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <label className="field">
          <span className="field-label">Dosya</span>
          <select
            className="select"
            value={durum.dosyaId}
            onChange={(e) => guncelle('dosyaId', e.target.value)}
          >
            <option value="">Genel görev (dosyasız)</option>
            {(dosyalar ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.baslik}
                {d.esasNo ? ` — ${d.esasNo}` : ''}
              </option>
            ))}
          </select>
        </label>

        <div className="field-row">
          <label className="field">
            <span className="field-label">Öncelik</span>
            <select
              className="select"
              value={durum.oncelik}
              onChange={(e) =>
                guncelle('oncelik', e.target.value as GorevOnceligi)
              }
            >
              {(['dusuk', 'normal', 'yuksek'] as const).map((o) => (
                <option key={o} value={o}>
                  {oncelikEtiketleri[o]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Vade</span>
            <input
              type="date"
              className="input"
              value={durum.vadeTarihi}
              onChange={(e) => guncelle('vadeTarihi', e.target.value)}
            />
          </label>
        </div>

        {!duzenleme ? (
          <TekrarSecici
            siklik={tekrar}
            adet={tekrarAdet}
            onSiklik={setTekrar}
            onAdet={setTekrarAdet}
            ipucu="Tekrar için vade tarihi gerekir; her yineleme vadeyi taşır."
          />
        ) : mevcut?.seriesId ? (
          <p className="field-hint">
            Bu görev {seriSayisi} görevlik bir tekrar serisinin parçası.
            Değişiklik yalnızca bu görevi etkiler.
          </p>
        ) : null}

        <label className="field">
          <span className="field-label">Atanan</span>
          <select
            className="select"
            value={durum.atananKullaniciId}
            onChange={(e) => guncelle('atananKullaniciId', e.target.value)}
          >
            <option value="">Atanmadı</option>
            {(kullanicilar ?? []).map((k) => (
              <option key={k.id} value={k.id}>
                {k.ad} — {k.unvan}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Açıklama</span>
          <textarea
            className="textarea"
            value={durum.aciklama}
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
            {duzenleme ? 'Değişikliği kaydet' : 'Görevi ekle'}
          </button>
          {duzenleme && !silmeOnayi ? (
            <button
              type="button"
              className="button-danger"
              onClick={() => setSilmeOnayi(true)}
            >
              Sil
            </button>
          ) : null}
          {duzenleme && silmeOnayi ? (
            <>
              <button
                type="button"
                className="button-danger"
                onClick={() => void sil()}
              >
                {mevcut?.seriesId ? 'Yalnızca bu' : 'Emin misiniz?'}
              </button>
              {mevcut?.seriesId ? (
                <button
                  type="button"
                  className="button-danger"
                  onClick={() => void seriSil()}
                >
                  Tüm seri ({seriSayisi})
                </button>
              ) : null}
              <button
                type="button"
                className="button-quiet"
                onClick={() => setSilmeOnayi(false)}
              >
                Vazgeç
              </button>
            </>
          ) : null}
        </div>
      </section>
    </>
  )
}
