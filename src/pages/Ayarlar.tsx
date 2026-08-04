import { useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { useAyarlar } from '../data/sorgular'
import {
  ayarlariGuncelle,
  hatirlatmaProfiliGuncelle,
  HATIRLATMA_SECENEKLERI,
  kanallariGuncelle,
} from '../data/ayarlarIslemleri'
import {
  kanalDurumEtiketleri,
  kanalDurumlari,
  pushIzniIste,
} from '../services/bildirim'
import { yedegiIndir, yedektenGeriYukle, YedekHatasi } from '../data/yedek'
import { db } from '../data/db'
import { goreliZaman } from '../domain/tarih'
import type { HatirlatmaKanali, OlayTuru } from '../domain/types'
import { VARSAYILAN_HATIRLATMA_OFSETLERI } from '../domain/types'

const profilTurleri: Array<{ tur: OlayTuru; etiket: string }> = [
  { tur: 'durusma', etiket: 'Duruşma' },
  { tur: 'son-tarih', etiket: 'Hukuki süre' },
]

function OfsetProfili({
  tur,
  etiket,
  secili,
}: {
  tur: OlayTuru
  etiket: string
  secili: number[]
}) {
  const degistir = (ofset: number) => {
    const yeni = secili.includes(ofset)
      ? secili.filter((o) => o !== ofset)
      : [...secili, ofset]
    void hatirlatmaProfiliGuncelle(tur, yeni)
  }
  return (
    <div className="ayar-profil">
      <p className="ayar-profil-baslik">{etiket}</p>
      <div className="ofset-grid">
        {HATIRLATMA_SECENEKLERI.map(({ ofset, etiket: e }) => (
          <button
            key={ofset}
            type="button"
            className="ofset-chip"
            aria-pressed={secili.includes(ofset)}
            onClick={() => degistir(ofset)}
          >
            {secili.includes(ofset) ? (
              <Icon name="check" size={13} />
            ) : (
              <Icon name="plus" size={13} />
            )}
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Ayarlar() {
  const ayarlar = useAyarlar()
  const dosyaGirisRef = useRef<HTMLInputElement>(null)
  const [kanallar, setKanallar] = useState(kanalDurumlari())
  const [mesaj, setMesaj] = useState<string | null>(null)
  const [sifirlamaOnayi, setSifirlamaOnayi] = useState(false)

  if (!ayarlar) {
    return (
      <section className="card section-card">
        <p className="section-empty">Ayarlar yükleniyor…</p>
      </section>
    )
  }

  const kanalAcik = (k: HatirlatmaKanali) =>
    ayarlar.varsayilanKanallar.includes(k)

  const kanalDegistir = async (k: HatirlatmaKanali) => {
    let liste = kanalAcik(k)
      ? ayarlar.varsayilanKanallar.filter((x) => x !== k)
      : [...ayarlar.varsayilanKanallar, k]
    if (k === 'push' && !kanalAcik(k)) {
      const durum = await pushIzniIste()
      setKanallar(kanalDurumlari())
      if (durum !== 'hazir') {
        setMesaj('Cihaz bildirimi için izin verilmedi.')
        liste = liste.filter((x) => x !== 'push')
      }
    }
    await kanallariGuncelle(liste)
  }

  const geriYukle = async (dosya: File | undefined) => {
    if (!dosya) return
    try {
      const metin = await dosya.text()
      await yedektenGeriYukle(metin)
      setMesaj('Yedek geri yüklendi.')
    } catch (e) {
      setMesaj(e instanceof YedekHatasi ? e.message : 'Yedek okunamadı.')
    } finally {
      if (dosyaGirisRef.current) dosyaGirisRef.current.value = ''
    }
  }

  const verileriSifirla = async () => {
    await db.delete()
    // Sayfayı taze aç: şema yeniden kurulur ve örnek veri tohumlanır.
    window.location.reload()
  }

  return (
    <>
      <div className="form-head">
        <p className="t-label">Çalışma alanı</p>
        <h1 className="t-title">Ayarlar</h1>
      </div>

      {mesaj ? <p className="ayar-mesaj">{mesaj}</p> : null}

      {/* Profil */}
      <section className="card form-card">
        <p className="ayar-baslik">Profil</p>
        <label className="field">
          <span className="field-label">Ad soyad</span>
          <input
            className="input"
            defaultValue={ayarlar.kullaniciAdi}
            onBlur={(e) => void ayarlariGuncelle({ kullaniciAdi: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="field-label">Unvan</span>
          <input
            className="input"
            defaultValue={ayarlar.unvan}
            onBlur={(e) => void ayarlariGuncelle({ unvan: e.target.value })}
          />
        </label>
      </section>

      {/* Hatırlatma profilleri */}
      <section className="card form-card">
        <div>
          <p className="ayar-baslik">Hatırlatma zamanları</p>
          <p className="field-hint">
            Her olay türü için ne zaman hatırlatılacağını seçin.
          </p>
        </div>
        {profilTurleri.map(({ tur, etiket }) => (
          <OfsetProfili
            key={tur}
            tur={tur}
            etiket={etiket}
            secili={
              ayarlar.hatirlatmaOfsetleri[tur] ?? [
                ...VARSAYILAN_HATIRLATMA_OFSETLERI,
              ]
            }
          />
        ))}
      </section>

      {/* Bildirim kanalları */}
      <section className="card form-card">
        <p className="ayar-baslik">Bildirim kanalları</p>
        {kanallar.map((k) => {
          const acik = kanalAcik(k.kanal)
          const kullanilabilir =
            k.durum === 'hazir' || k.durum === 'izin-gerekli'
          return (
            <button
              key={k.kanal}
              type="button"
              className="switch-row"
              aria-pressed={acik}
              disabled={!kullanilabilir}
              onClick={() => void kanalDegistir(k.kanal)}
            >
              <span>
                <span style={{ display: 'block' }}>
                  {k.etiket}
                  {!kullanilabilir ? (
                    <span className="kanal-rozet">
                      {kanalDurumEtiketleri[k.durum]}
                    </span>
                  ) : null}
                </span>
                <span className="field-hint">{k.aciklama}</span>
              </span>
              <span className="switch-track" aria-hidden="true">
                <span className="switch-thumb" />
              </span>
            </button>
          )
        })}
      </section>

      {/* Sessiz saatler */}
      <section className="card form-card">
        <p className="ayar-baslik">Sessiz saatler</p>
        <div className="field-row">
          <label className="field">
            <span className="field-label">Başlangıç</span>
            <input
              type="time"
              className="input"
              defaultValue={ayarlar.sessizSaatBaslangic ?? ''}
              onBlur={(e) =>
                void ayarlariGuncelle({ sessizSaatBaslangic: e.target.value })
              }
            />
          </label>
          <label className="field">
            <span className="field-label">Bitiş</span>
            <input
              type="time"
              className="input"
              defaultValue={ayarlar.sessizSaatBitis ?? ''}
              onBlur={(e) =>
                void ayarlariGuncelle({ sessizSaatBitis: e.target.value })
              }
            />
          </label>
        </div>
        <p className="field-hint">
          Bu saatler arasında cihaz bildirimi gönderilmez.
        </p>
      </section>

      {/* Yapay zekâ */}
      <section className="card form-card">
        <p className="ayar-baslik">Yapay zekâ asistanı</p>
        <button
          type="button"
          className="switch-row"
          aria-pressed={ayarlar.llmEtkin}
          onClick={() => void ayarlariGuncelle({ llmEtkin: !ayarlar.llmEtkin })}
        >
          <span>
            <span style={{ display: 'block' }}>LLM katmanı</span>
            <span className="field-hint">
              Asistan varsayılan olarak yalnızca kural motorunu kullanır. LLM
              katmanı henüz bağlanmadı; açık olsa da müvekkil verisi cihazdan
              çıkmaz.
            </span>
          </span>
          <span className="switch-track" aria-hidden="true">
            <span className="switch-thumb" />
          </span>
        </button>
      </section>

      {/* Yedekleme */}
      <section className="card form-card">
        <p className="ayar-baslik">Yedekleme</p>
        <p className="field-hint">
          Tüm veriniz bu cihazda saklanır. Düzenli yedek alın; tarayıcı verisi
          silinirse yedekten geri yükleyebilirsiniz.
          {ayarlar.sonYedeklemeZamani
            ? ` Son yedek: ${goreliZaman(ayarlar.sonYedeklemeZamani)}.`
            : ''}
        </p>
        <input
          ref={dosyaGirisRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => void geriYukle(e.target.files?.[0])}
        />
        <div className="form-actions">
          <button
            type="button"
            className="button-primary"
            onClick={() => void yedegiIndir()}
          >
            Yedek indir
          </button>
          <button
            type="button"
            className="button-quiet"
            onClick={() => dosyaGirisRef.current?.click()}
          >
            Geri yükle
          </button>
        </div>
      </section>

      {/* Uygulama kilidi (F15 — yakında) */}
      <section className="card form-card">
        <p className="ayar-baslik">Güvenlik</p>
        <div className="switch-row" aria-disabled="true" style={{ opacity: 0.6 }}>
          <span>
            <span style={{ display: 'block' }}>Uygulama kilidi</span>
            <span className="field-hint">
              PIN ve biyometri ile kilit yakında eklenecek.
            </span>
          </span>
          <span className="kanal-rozet">Yakında</span>
        </div>
        <p className="field-hint">
          Uygulama KVKK’ya uygun tasarlanmıştır: müvekkil verisi cihazdan dışarı
          çıkmaz, üçüncü taraf analitiği yoktur.
        </p>
      </section>

      {/* Veri sıfırlama */}
      <section className="card form-card">
        <p className="ayar-baslik">Verileri sıfırla</p>
        <p className="field-hint">
          Tüm dosya, müvekkil, takvim ve finans kayıtları silinir ve örnek veri
          yeniden yüklenir. Bu işlem geri alınamaz.
        </p>
        <button
          type="button"
          className="button-danger"
          style={{ alignSelf: 'flex-start' }}
          onClick={() =>
            sifirlamaOnayi ? void verileriSifirla() : setSifirlamaOnayi(true)
          }
        >
          {sifirlamaOnayi ? 'Emin misiniz? Tüm veriyi sil' : 'Verileri sıfırla'}
        </button>
      </section>

      <p className="t-small t-muted" style={{ padding: '0 var(--space-1)' }}>
        JurisCalendar · derleme {__BUILD_ID__} · veriler cihazınızda saklanır.
      </p>
    </>
  )
}
