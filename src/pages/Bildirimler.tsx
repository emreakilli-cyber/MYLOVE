import { Icon } from '../components/Icon'
import { SatirIskeleti } from '../components/BolumKarti'
import { Link } from '../router'
import {
  useYaklasanHatirlatmalar,
  type YaklasanHatirlatma,
} from '../data/hatirlatmaSorgulari'
import { useAyarlar } from '../data/sorgular'
import { goreliZaman, kisaTarih, saat } from '../domain/tarih'
import { pushIzniIste } from '../services/bildirim'
import {
  ayarlariGuncelle,
  hatirlatmaErtele,
  hatirlatmaErtelemeyiKaldir,
} from '../data/ayarlarIslemleri'

/** Erteleme seçenekleri; her tık için o anki zamana göre hedef üretir. */
const ERTELEME_SECENEKLERI: ReadonlyArray<{
  etiket: string
  hedef: () => Date
}> = [
  { etiket: '1 saat', hedef: () => new Date(Date.now() + 60 * 60_000) },
  { etiket: '3 saat', hedef: () => new Date(Date.now() + 3 * 60 * 60_000) },
  {
    etiket: 'Yarın',
    hedef: () => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      d.setHours(9, 0, 0, 0)
      return d
    },
  },
  { etiket: '1 hafta', hedef: () => new Date(Date.now() + 7 * 24 * 60 * 60_000) },
]

export function Bildirimler() {
  const hatirlatmalar = useYaklasanHatirlatmalar(30)
  const ayarlar = useAyarlar()

  const pushKapali =
    ayarlar !== undefined && !ayarlar.varsayilanKanallar.includes('push')

  const pushAc = async () => {
    const durum = await pushIzniIste()
    if (durum === 'hazir' && ayarlar) {
      await ayarlariGuncelle({
        varsayilanKanallar: [...ayarlar.varsayilanKanallar, 'push'],
      })
    }
  }

  const gecmis = hatirlatmalar?.filter((h) => h.gecti) ?? []
  const yaklasan = hatirlatmalar?.filter((h) => !h.gecti) ?? []

  return (
    <>
      <div className="form-head">
        <p className="t-label">Takipte kalın</p>
        <h1 className="t-title">Bildirimler</h1>
      </div>

      {/* Cihaz bildirimi kapalıysa öneri */}
      {pushKapali && typeof Notification !== 'undefined' ? (
        <section className="card bildirim-oneri">
          <Icon name="bell" size={20} className="bildirim-oneri-icon" />
          <div className="bildirim-oneri-metin">
            <p className="bildirim-oneri-baslik">Cihaz bildirimlerini açın</p>
            <p className="field-hint">
              Uygulama açıkken yaklaşan süre ve duruşmalar cihaz bildirimi
              olarak da düşsün.
            </p>
          </div>
          <button
            type="button"
            className="button-primary"
            style={{ flex: 'none', padding: 'var(--space-2) var(--space-4)' }}
            onClick={() => void pushAc()}
          >
            İzin ver
          </button>
        </section>
      ) : null}

      {hatirlatmalar === undefined ? (
        <section className="card section-card">
          <SatirIskeleti adet={5} />
        </section>
      ) : hatirlatmalar.length === 0 ? (
        <section className="card section-card">
          <p className="section-empty">
            Önümüzdeki 30 gün için hatırlatma yok.
          </p>
        </section>
      ) : (
        <>
          {gecmis.length > 0 ? (
            <section className="card section-card">
              <div className="section-head">
                <div>
                  <p className="t-label section-eyebrow">Zamanı geldi</p>
                  <h2 className="t-title">Şimdi</h2>
                </div>
              </div>
              <div className="divide-rows">
                {gecmis.map((h) => (
                  <HatirlatmaSatiri key={h.id} h={h} vurgulu />
                ))}
              </div>
            </section>
          ) : null}

          <section className="card section-card">
            <div className="section-head">
              <div>
                <p className="t-label section-eyebrow">Sırada</p>
                <h2 className="t-title">Yaklaşan</h2>
              </div>
            </div>
            {yaklasan.length === 0 ? (
              <p className="section-empty">Yaklaşan hatırlatma yok.</p>
            ) : (
              <div className="divide-rows">
                {yaklasan.map((h) => (
                  <HatirlatmaSatiri key={h.id} h={h} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <p className="t-small t-muted" style={{ padding: '0 var(--space-1)' }}>
        Hatırlatmalar takvim ve süre kayıtlarınızdan anlık hesaplanır.
        Zamanlarını Ayarlar’dan değiştirebilirsiniz.
      </p>
    </>
  )
}

function HatirlatmaSatiri({
  h,
  vurgulu = false,
}: {
  h: YaklasanHatirlatma
  vurgulu?: boolean
}) {
  return (
    <div className="hatirlatma-blok">
      <Link to={h.yol} className={`row accent-${h.accent}`}>
        <span className="row-tile" aria-hidden="true">
          <Icon name={h.icon} size={18} />
        </span>
        <span className="row-main">
          <span className="row-title truncate">{h.baslik}</span>
          <span className="row-sub truncate">
            {h.altBaslik} · {kisaTarih(h.hedefZaman.slice(0, 10))}{' '}
            {saat(h.hedefZaman)}
          </span>
        </span>
        <span
          className="deadline-kalan"
          style={{ color: vurgulu ? 'var(--cat-red-fg)' : 'var(--text-muted)' }}
        >
          {vurgulu
            ? goreliZaman(h.zaman)
            : h.ertelendi
              ? 'ertelendi'
              : h.ofsetEtiketi}
        </span>
      </Link>

      {vurgulu ? (
        <div className="ertele-row">
          <span className="ertele-etiket">Ertele:</span>
          {ERTELEME_SECENEKLERI.map((s) => (
            <button
              key={s.etiket}
              type="button"
              className="ertele-chip"
              onClick={() => void hatirlatmaErtele(h.id, s.hedef())}
            >
              {s.etiket}
            </button>
          ))}
        </div>
      ) : h.ertelendi ? (
        <div className="ertele-row">
          <button
            type="button"
            className="ertele-chip"
            onClick={() => void hatirlatmaErtelemeyiKaldir(h.id)}
          >
            Ertelemeyi geri al
          </button>
        </div>
      ) : null}
    </div>
  )
}
