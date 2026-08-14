import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { Link, useLocation, useNavigate } from '../router'
import {
  esasEtiketleri,
  kolEtiketleri,
  kuralBul,
  sureHesapla,
  SURE_KATALOGU,
  type SureKurali,
} from '../domain/sureHesabi'
import { DINI_BAYRAM_KAPSAMI } from '../domain/tatil'
import { sureKaydet } from '../data/sureIslemleri'
import { useAcikDosyalar } from '../data/olayIslemleri'
import { bugunIso, kalanSureMetni, tamTarih } from '../domain/tarih'

/*
 * Süre hesaplama ekranı (şartname md. 5).
 * Kullanıcı süre türünü ve başlangıç (tebliğ/tefhim) tarihini girer; motor
 * son günü hesaplar, gerekçeleri gösterir. İsterse dosyaya ve takvime işlenir.
 */

// Kuralları yargı koluna göre grupla.
const gruplu = SURE_KATALOGU.reduce<Record<string, SureKurali[]>>((acc, k) => {
  ;(acc[k.kol] ??= []).push(k)
  return acc
}, {})

const kapsamDisi = (gun: string): boolean => {
  const yil = Number(gun.slice(0, 4))
  return yil < DINI_BAYRAM_KAPSAMI.ilk || yil > DINI_BAYRAM_KAPSAMI.son
}

export function SureHesapla() {
  const navigate = useNavigate()
  const { query } = useLocation()
  const onDosya = query.get('dosya') ?? ''
  const dosyalar = useAcikDosyalar()

  const [kuralId, setKuralId] = useState<string>('istinaf-hmk-345')
  const [baslangic, setBaslangic] = useState<string>(bugunIso())
  const [dosyaId, setDosyaId] = useState<string>(onDosya)
  const [kaydediliyor, setKaydediliyor] = useState(false)

  const kural = kuralBul(kuralId)

  const sonuc = useMemo(() => {
    if (!kural || !baslangic) return null
    return sureHesapla(kural, baslangic)
  }, [kural, baslangic])

  const kaydet = async () => {
    if (!sonuc || !dosyaId) return
    setKaydediliyor(true)
    try {
      await sureKaydet({ dosyaId, sonuc })
      navigate(`/dosyalar/${dosyaId}`)
    } finally {
      setKaydediliyor(false)
    }
  }

  return (
    <>
      <Link to={onDosya ? `/dosyalar/${onDosya}` : '/takvim'} className="page-back">
        <Icon name="arrow-left" size={17} />
        Geri
      </Link>

      <div className="form-head">
        <p className="t-label">Hukuki süre</p>
        <h1 className="t-title">Süre hesapla</h1>
      </div>

      <section className="card form-card" data-tur="sure">
        <label className="field">
          <span className="field-label">Süre türü</span>
          <select
            className="select"
            value={kuralId}
            onChange={(e) => setKuralId(e.target.value)}
          >
            {Object.entries(gruplu).map(([kol, kurallar]) => (
              <optgroup key={kol} label={kolEtiketleri[kol as SureKurali['kol']]}>
                {kurallar.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.ad} — {k.kanun}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {kural?.aciklama ? (
            <span className="field-hint">{kural.aciklama}</span>
          ) : null}
        </label>

        <label className="field">
          <span className="field-label">
            {kural ? esasEtiketleri[kural.esas] : 'Başlangıç tarihi'}
          </span>
          <input
            type="date"
            className="input"
            value={baslangic}
            onChange={(e) => setBaslangic(e.target.value)}
          />
          {baslangic ? (
            <span className="field-hint">{tamTarih(baslangic)}</span>
          ) : null}
        </label>
      </section>

      {sonuc ? (
        <section className={`card sonuc-card accent-${
          sonuc.adliTatilUygulandi ? 'purple' : 'blue'
        }`}>
          <p className="t-label sonuc-eyebrow">Hesaplanan son gün</p>
          <p className="sonuc-tarih">{tamTarih(sonuc.sonTarih)}</p>
          <p className="sonuc-kalan">{kalanSureMetni(sonuc.sonTarih)}</p>

          <div className="sonuc-satir">
            <span className="sonuc-satir-etiket">Süre</span>
            <span className="sonuc-satir-deger">
              {sonuc.kural.miktar}{' '}
              {sonuc.kural.birim === 'gun'
                ? 'gün'
                : sonuc.kural.birim === 'hafta'
                  ? 'hafta'
                  : sonuc.kural.birim === 'ay'
                    ? 'ay'
                    : 'yıl'}{' '}
              · {sonuc.kural.kanun}
            </span>
          </div>
          <div className="sonuc-satir">
            <span className="sonuc-satir-etiket">Ham son gün</span>
            <span className="sonuc-satir-deger">{tamTarih(sonuc.hamSonTarih)}</span>
          </div>

          {sonuc.gerekceler.length > 0 ? (
            <ul className="sonuc-gerekce">
              {sonuc.gerekceler.map((g, i) => (
                <li key={i}>
                  <Icon name="calendar-clock" size={14} />
                  {g}
                </li>
              ))}
            </ul>
          ) : null}

          {kapsamDisi(sonuc.hamSonTarih) ? (
            <p className="sonuc-uyari">
              Bu tarih dinî bayram tablosunun kapsamı ({DINI_BAYRAM_KAPSAMI.ilk}–
              {DINI_BAYRAM_KAPSAMI.son}) dışında; bayram kaydırması eksik olabilir.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="card form-card">
        <label className="field">
          <span className="field-label">Dosya</span>
          <select
            className="select"
            value={dosyaId}
            onChange={(e) => setDosyaId(e.target.value)}
          >
            <option value="">Kaydetmeden hesapla</option>
            {(dosyalar ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.baslik}
                {d.esasNo ? ` — ${d.esasNo}` : ''}
              </option>
            ))}
          </select>
          <span className="field-hint">
            Dosya seçilirse süre dosyaya işlenir ve son gün takvimde,
            hatırlatmalarda ve dışa aktarımda görünür.
          </span>
        </label>

        <button
          type="button"
          className="button-primary"
          disabled={!dosyaId || !sonuc || kaydediliyor}
          onClick={() => void kaydet()}
        >
          {dosyaId ? 'Dosyaya kaydet' : 'Kaydetmek için dosya seçin'}
        </button>
      </section>

      <p className="t-small t-muted" style={{ padding: '0 var(--space-1)' }}>
        Bu hesap <strong>bilgilendirme amaçlıdır</strong> ve hukuki tavsiye
        niteliği taşımaz. Resmî ve dinî tatiller ile adli tatil gözetilir; ancak
        son günün doğruluğunun teyidi kullanıcının sorumluluğundadır.
      </p>
    </>
  )
}
