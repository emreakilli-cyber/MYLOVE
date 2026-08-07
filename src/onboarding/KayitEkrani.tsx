import { useState } from 'react'
import { Icon } from '../components/Icon'
import { useAyarlar } from '../data/sorgular'
import { ayarlariGuncelle } from '../data/ayarlarIslemleri'

/*
 * Kayıt / profil adımı (onay sonrası). Ad, soyad, ünvan alınır ve yerelde
 * saklanır; ana ekran selamlaması ve yan menü bunu gösterir.
 *
 * Giriş yöntemi: e-posta yolu yerel profil oluşturur (gerçek e-posta doğrulama
 * sunucusu ayrı bir adımdır — bkz. docs/PLAN.md BEKLEYEN). Google/Apple butonları
 * görünür ama OAuth henüz yapılandırılmadığı için açıkça öyle bildirilir.
 */

interface KayitEkraniProps {
  readonly onTamam: () => void
}

function adSoyadBol(tamAd: string | undefined): [string, string] {
  const parcalar = (tamAd ?? '').trim().split(/\s+/).filter(Boolean)
  if (parcalar.length === 0) return ['', '']
  const soyad = parcalar.length > 1 ? parcalar[parcalar.length - 1]! : ''
  const ad = parcalar.slice(0, Math.max(1, parcalar.length - 1)).join(' ')
  return [ad, soyad]
}

export function KayitEkrani({ onTamam }: KayitEkraniProps) {
  const ayarlar = useAyarlar()
  const [onceAd, onceSoyad] = adSoyadBol(ayarlar?.kullaniciAdi)

  const [yontem, setYontem] = useState<'secim' | 'eposta'>('secim')
  const [ad, setAd] = useState(ayarlar?.ad ?? onceAd)
  const [soyad, setSoyad] = useState(ayarlar?.soyad ?? onceSoyad)
  const [unvan, setUnvan] = useState(ayarlar?.unvan ?? '')
  const [eposta, setEposta] = useState(ayarlar?.eposta ?? '')
  const [saglayiciNotu, setSaglayiciNotu] = useState<string | null>(null)
  const [hata, setHata] = useState<string | null>(null)

  const kaydet = async (girisYontemi: 'eposta') => {
    if (!ad.trim() || !soyad.trim()) {
      setHata('Ad ve soyad gerekli.')
      return
    }
    await ayarlariGuncelle({
      ad: ad.trim(),
      soyad: soyad.trim(),
      kullaniciAdi: `${ad.trim()} ${soyad.trim()}`,
      unvan: unvan.trim() || 'Avukat',
      eposta: eposta.trim() || undefined,
      girisYontemi,
      profilKuruldu: true,
    })
    onTamam()
  }

  return (
    <div className="ob kayit-ekran" role="dialog" aria-label="Kayıt">
      <div className="ob-ust">
        <span className="ob-adim">Profil</span>
      </div>

      <div className="kayit-govde">
        <span className="ob-logo" aria-hidden="true">
          J
        </span>
        <p className="ob-etiket">HOŞ GELDİNİZ</p>
        <h1 className="ob-baslik">Sizi tanıyalım.</h1>

        {yontem === 'secim' ? (
          <div className="kayit-secim">
            <button
              type="button"
              className="ob-cta ob-cta-buyuk"
              onClick={() => setYontem('eposta')}
            >
              <Icon name="mail" size={17} /> E-posta ile devam et
            </button>
            <button
              type="button"
              className="kayit-saglayici"
              onClick={() =>
                setSaglayiciNotu(
                  'Google ile giriş henüz yapılandırılmadı (kurulum gerekiyor).',
                )
              }
            >
              Google ile devam et
            </button>
            <button
              type="button"
              className="kayit-saglayici"
              onClick={() =>
                setSaglayiciNotu(
                  'Apple ile giriş henüz yapılandırılmadı (kurulum gerekiyor).',
                )
              }
            >
              Apple ile devam et
            </button>
            {saglayiciNotu ? (
              <p className="field-hint kayit-not">{saglayiciNotu}</p>
            ) : null}
            <p className="field-hint kayit-not">
              Bilgileriniz yalnızca bu cihazda saklanır.
            </p>
          </div>
        ) : (
          <div className="kayit-form">
            <div className="field-row">
              <label className="field">
                <span className="field-label">Ad</span>
                <input
                  className="input"
                  value={ad}
                  autoComplete="given-name"
                  onChange={(e) => setAd(e.target.value)}
                />
              </label>
              <label className="field">
                <span className="field-label">Soyad</span>
                <input
                  className="input"
                  value={soyad}
                  autoComplete="family-name"
                  onChange={(e) => setSoyad(e.target.value)}
                />
              </label>
            </div>
            <label className="field">
              <span className="field-label">Ünvan</span>
              <input
                className="input"
                value={unvan}
                placeholder="Avukat"
                onChange={(e) => setUnvan(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-label">E-posta (isteğe bağlı)</span>
              <input
                className="input"
                type="email"
                inputMode="email"
                value={eposta}
                autoComplete="email"
                placeholder="ornek@buro.av.tr"
                onChange={(e) => setEposta(e.target.value)}
              />
            </label>
            {hata ? <p className="field-error">{hata}</p> : null}
            <div className="kayit-form-alt">
              <button
                type="button"
                className="ob-cta ob-cta-buyuk"
                onClick={() => void kaydet('eposta')}
              >
                Devam
              </button>
              <button
                type="button"
                className="button-quiet"
                onClick={() => setYontem('secim')}
              >
                Geri
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
