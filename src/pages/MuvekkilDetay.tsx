import { useState } from 'react'
import { Icon } from '../components/Icon'
import { SilDugmesi } from '../components/SilDugmesi'
import { SatirIskeleti } from '../components/BolumKarti'
import { Link } from '../router'
import {
  muvekkilTurEtiketleri,
  useMuvekkilProfili,
} from '../data/muvekkilSorgulari'
import { muvekkilNotEkle } from '../data/muvekkilIslemleri'
import { notSil } from '../data/dosyaIslemleri'
import {
  dosyaDurumEtiketleri,
  dosyaTuruEtiketleri,
} from '../data/dosyaSorgulari'
import { tutarTam } from '../domain/para'
import { goreliZaman, tamTarih } from '../domain/tarih'

export function MuvekkilDetay({ id }: { id?: string }) {
  const profil = useMuvekkilProfili(id)
  const [gorusme, setGorusme] = useState('')
  const [kaydediliyor, setKaydediliyor] = useState(false)

  if (profil === undefined) {
    return (
      <section className="card section-card">
        <SatirIskeleti adet={4} />
      </section>
    )
  }

  if (profil === null) {
    return (
      <section className="card placeholder">
        <div className="placeholder-body">
          <p className="t-label placeholder-crumb">Müvekkiller</p>
          <h1 className="t-display placeholder-title">Müvekkil bulunamadı.</h1>
          <Link to="/muvekkiller" className="placeholder-link">
            Müvekkil listesine dön
            <Icon name="arrow-up-right" size={15} />
          </Link>
        </div>
      </section>
    )
  }

  const { muvekkil, dosyalar, finansOzet, notlar } = profil
  const acikDosyalar = dosyalar.filter((d) => d.durum !== 'kapali')

  const gorusmeKaydet = async () => {
    // Çift dokunuş iki özdeş görüşme notu oluşturmasın (kayıt uçarken kilitle).
    if (!gorusme.trim() || kaydediliyor) return
    setKaydediliyor(true)
    try {
      await muvekkilNotEkle(muvekkil.id, gorusme, 'gorusme')
      setGorusme('')
    } finally {
      setKaydediliyor(false)
    }
  }

  return (
    <>
      <div className="detail-topline">
        <Link to="/muvekkiller" className="page-back">
          <Icon name="arrow-left" size={17} />
          Müvekkillere dön
        </Link>
        <Link to={`/muvekkiller/${muvekkil.id}/duzenle`} className="detail-edit">
          <Icon name="settings" size={15} />
          Düzenle
        </Link>
      </div>

      <section className="card detail-hero accent-blue">
        <p className="t-label">{muvekkilTurEtiketleri[muvekkil.tur]}</p>
        <h1 className="t-title detail-title">{muvekkil.ad}</h1>
        {muvekkil.etiketler.length > 0 ? (
          <div className="detail-tags">
            {muvekkil.etiketler.map((e) => (
              <span key={e} className="tag tag-quiet">
                {e}
              </span>
            ))}
          </div>
        ) : null}

        {/* Hızlı iletişim */}
        <div className="quick-actions">
          {muvekkil.telefon ? (
            // tel: URI'de boşluk/tire/parantez geçmemeli (RFC 3966); kullanıcı
            // "+90 555 111 22 33" gibi biçimli girse de arama açılsın diye
            // yalnızca rakam ve baştaki + bırakılır.
            <a
              href={`tel:${muvekkil.telefon.replace(/[^\d+]/g, '')}`}
              className="quick-action"
            >
              <Icon name="phone" size={16} />
              Ara
            </a>
          ) : null}
          {muvekkil.eposta ? (
            <a href={`mailto:${muvekkil.eposta}`} className="quick-action">
              <Icon name="mail" size={16} />
              E-posta
            </a>
          ) : null}
        </div>
      </section>

      {/* İletişim künyesi */}
      <section className="card">
        <div className="info-grid">
          <span className="info-item">
            <span className="info-label">Telefon</span>
            <span className="info-value" data-bos={!muvekkil.telefon}>
              {muvekkil.telefon ?? '—'}
            </span>
          </span>
          <span className="info-item">
            <span className="info-label">E-posta</span>
            <span className="info-value" data-bos={!muvekkil.eposta}>
              {muvekkil.eposta ?? '—'}
            </span>
          </span>
          <span className="info-item">
            <span className="info-label">
              {muvekkil.tur === 'tuzel' ? 'Vergi no' : 'TC kimlik'}
            </span>
            <span className="info-value" data-bos={!muvekkil.kimlikNo}>
              {muvekkil.kimlikNo ?? '—'}
            </span>
          </span>
          <span className="info-item">
            <span className="info-label">Bekleyen ödeme</span>
            <span
              className="info-value"
              style={{
                color:
                  finansOzet.bekleyen > 0
                    ? 'var(--cat-amber-text)'
                    : 'var(--text-primary)',
              }}
            >
              {tutarTam(finansOzet.bekleyen)}
            </span>
          </span>
          {muvekkil.adres ? (
            <span className="info-item" style={{ gridColumn: '1 / -1' }}>
              <span className="info-label">Adres</span>
              <span className="info-value">{muvekkil.adres}</span>
            </span>
          ) : null}
        </div>
      </section>

      {/* Dosyalar */}
      <section className="card section-card">
        <div className="section-head">
          <div>
            <p className="t-label section-eyebrow">
              {acikDosyalar.length} açık · {dosyalar.length} toplam
            </p>
            <h2 className="t-title">Dosyalar</h2>
          </div>
        </div>
        {dosyalar.length === 0 ? (
          <p className="section-empty">Bu müvekkile bağlı dosya yok.</p>
        ) : (
          <div className="divide-rows">
            {dosyalar.map((dosya) => (
              <Link
                key={dosya.id}
                to={`/dosyalar/${dosya.id}`}
                className="row accent-slate"
              >
                <span className="row-tile" aria-hidden="true">
                  <Icon name="folder" size={18} />
                </span>
                <span className="row-main">
                  <span className="row-title truncate">{dosya.baslik}</span>
                  <span className="row-sub truncate">
                    {[dosyaTuruEtiketleri[dosya.tur], dosya.mahkeme]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="tag tag-quiet">
                  {dosyaDurumEtiketleri[dosya.durum]}
                </span>
                <Icon name="chevron-right" size={16} className="row-chevron" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Görüşme geçmişi */}
      <section className="card section-card">
        <div className="section-head">
          <div>
            <p className="t-label section-eyebrow">İz bırakın</p>
            <h2 className="t-title">Görüşme geçmişi</h2>
          </div>
        </div>

        <div className="inline-form">
          <textarea
            className="textarea"
            value={gorusme}
            placeholder="Telefon görüşmesi, ofis ziyareti, özet…"
            onChange={(e) => setGorusme(e.target.value)}
          />
          <button
            type="button"
            className="button-primary"
            onClick={() => void gorusmeKaydet()}
            disabled={!gorusme.trim() || kaydediliyor}
          >
            Görüşmeyi kaydet
          </button>
        </div>

        {notlar.length > 0 ? (
          <div className="divide-rows">
            {notlar.map((not) => (
              <div key={not.id} className="row accent-purple">
                <span className="row-tile" aria-hidden="true">
                  <Icon
                    name={not.tur === 'gorusme' ? 'users' : 'sparkles'}
                    size={18}
                  />
                </span>
                <span className="row-main">
                  <span className="row-sub">{not.icerik}</span>
                  <span className="row-sub t-muted">
                    {not.tur === 'gorusme' ? 'Görüşme · ' : ''}
                    {goreliZaman(not.olusturmaTarihi)}
                  </span>
                </span>
                <SilDugmesi
                  onSil={() => void notSil(not.id)}
                  etiket="Kaydı sil"
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="section-empty">Henüz görüşme kaydı yok.</p>
        )}
      </section>

      <p className="t-small t-muted" style={{ padding: '0 var(--space-1)' }}>
        Müvekkile ait bilgiler yalnızca bu cihazda saklanır. Açılış tarihi ilk
        dosya:{' '}
        {/* `dosyalar` açık-önce sonra yeni→eski sıralı; en erken açılan dosya
            `.at(-1)` DEĞİL (o, kapalı grubun en eskisi olur). Gerçekten en erken
            açılış tarihini bul. */}
        {dosyalar.length > 0
          ? tamTarih(
              dosyalar.reduce((en, d) =>
                d.acilisTarihi < en.acilisTarihi ? d : en,
              ).acilisTarihi,
            )
          : '—'}
      </p>
    </>
  )
}
