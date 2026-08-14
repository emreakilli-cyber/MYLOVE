import { useEffect, useRef, useState } from 'react'
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
import {
  sifreliMi,
  yedegiIndir,
  yedektenGeriYukle,
  YedekHatasi,
} from '../data/yedek'
import { db } from '../data/db'
import { pinOzetiUret } from '../services/kripto'
import { SifreCozmeHatasi } from '../services/kripto'
import {
  biyometriDesteklenirMi,
  biyometriKaydet,
} from '../services/biyometri'
import { goreliZaman } from '../domain/tarih'
import type { HatirlatmaKanali, OlayTuru } from '../domain/types'
import { VARSAYILAN_HATIRLATMA_OFSETLERI } from '../domain/types'
import { YAZI_OLCEKLERI } from '../domain/yaziOlcegi'

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
  // PIN kurulum durumu
  const [pinFormu, setPinFormu] = useState(false)
  const [pin1, setPin1] = useState('')
  const [pin2, setPin2] = useState('')
  const [pinHata, setPinHata] = useState<string | null>(null)
  // Şifreli yedek
  const [yedekParola, setYedekParola] = useState('')
  // Geri yükleme için seçilen dosyayı beklet (şifreliyse parola sor)
  const [bekleyenGeriYukleme, setBekleyenGeriYukleme] = useState<string | null>(
    null,
  )
  const [geriYuklemeParola, setGeriYuklemeParola] = useState('')
  // Biyometri (WebAuthn) bu cihazda kullanılabilir mi?
  const [biyometriVar, setBiyometriVar] = useState(false)

  useEffect(() => {
    let iptal = false
    void biyometriDesteklenirMi().then((v) => {
      if (!iptal) setBiyometriVar(v)
    })
    return () => {
      iptal = true
    }
  }, [])

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
    const metin = await dosya.text()
    if (dosyaGirisRef.current) dosyaGirisRef.current.value = ''
    // Şifreliyse parola iste; değilse doğrudan yükle.
    if (sifreliMi(metin)) {
      setBekleyenGeriYukleme(metin)
      setMesaj(null)
      return
    }
    try {
      await yedektenGeriYukle(metin)
      setMesaj('Yedek geri yüklendi.')
    } catch (e) {
      setMesaj(e instanceof YedekHatasi ? e.message : 'Yedek okunamadı.')
    }
  }

  const sifreliGeriYukle = async () => {
    if (!bekleyenGeriYukleme) return
    try {
      await yedektenGeriYukle(bekleyenGeriYukleme, geriYuklemeParola)
      setMesaj('Şifreli yedek geri yüklendi.')
      setBekleyenGeriYukleme(null)
      setGeriYuklemeParola('')
    } catch (e) {
      setMesaj(
        e instanceof SifreCozmeHatasi || e instanceof YedekHatasi
          ? e.message
          : 'Yedek okunamadı.',
      )
    }
  }

  const pinKur = async () => {
    if (pin1.length < 4) {
      setPinHata('PIN en az 4 rakam olmalı.')
      return
    }
    if (pin1 !== pin2) {
      setPinHata('PIN’ler eşleşmiyor.')
      return
    }
    const ozet = await pinOzetiUret(pin1)
    await ayarlariGuncelle({
      pinOzeti: ozet,
      pinUzunlugu: pin1.length,
      kilitEtkin: true,
    })
    setPinFormu(false)
    setPin1('')
    setPin2('')
    setPinHata(null)
    setMesaj('Uygulama kilidi açıldı.')
  }

  const kilidiKaldir = async () => {
    await ayarlariGuncelle({
      kilitEtkin: false,
      pinOzeti: undefined,
      biyometriKimlikB64: undefined,
    })
    setMesaj('Uygulama kilidi kapatıldı.')
  }

  const biyometriAc = async () => {
    const kimlik = await biyometriKaydet()
    if (kimlik) {
      await ayarlariGuncelle({ biyometriKimlikB64: kimlik })
      setMesaj('Biyometrik açış etkinleştirildi.')
    } else {
      setMesaj('Biyometrik açış kurulamadı ya da iptal edildi.')
    }
  }

  const biyometriKapat = async () => {
    await ayarlariGuncelle({ biyometriKimlikB64: undefined })
    setMesaj('Biyometrik açış kapatıldı.')
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

      {mesaj ? (
        <p className="ayar-mesaj" role="status" aria-live="polite">
          {mesaj}
        </p>
      ) : null}

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

      {/* Erişilebilirlik — yazı boyutu */}
      <section className="card form-card">
        <div>
          <p className="ayar-baslik">Yazı boyutu</p>
          <p className="field-hint">
            Arayüzü daha rahat okumak için yazıyı büyütebilirsiniz; tüm ekranlar
            birlikte ölçeklenir.
          </p>
        </div>
        <div className="chip-row" role="group" aria-label="Yazı boyutu">
          {YAZI_OLCEKLERI.map((o) => (
            <button
              key={o.deger}
              type="button"
              className="chip"
              aria-pressed={(ayarlar.yaziOlcegi ?? 'normal') === o.deger}
              onClick={() => void ayarlariGuncelle({ yaziOlcegi: o.deger })}
            >
              {o.etiket}
            </button>
          ))}
        </div>
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
              Asistan varsayılan olarak yalnızca cihaz içi kural motorunu
              kullanır. Bu katmanı açarsanız, sorduğunuz soru ve seçtiğiniz
              dosyanın <strong>kısa özeti</strong> aşağıdaki uç noktaya
              gönderilir — ham müvekkil kaydı gitmez. Kendi anahtarınızı kullanın.
            </span>
          </span>
          <span className="switch-track" aria-hidden="true">
            <span className="switch-thumb" />
          </span>
        </button>

        {ayarlar.llmEtkin ? (
          <>
            <label className="field">
              <span className="field-label">
                Uç nokta (OpenAI uyumlu /chat/completions)
              </span>
              <input
                className="input"
                type="url"
                inputMode="url"
                placeholder="https://api.openai.com/v1/chat/completions"
                defaultValue={ayarlar.llmUcNokta ?? ''}
                onBlur={(e) =>
                  void ayarlariGuncelle({ llmUcNokta: e.target.value.trim() })
                }
              />
            </label>
            <label className="field">
              <span className="field-label">Model</span>
              <input
                className="input"
                placeholder="gpt-4o-mini"
                defaultValue={ayarlar.llmModel ?? ''}
                onBlur={(e) =>
                  void ayarlariGuncelle({ llmModel: e.target.value.trim() })
                }
              />
            </label>
            <label className="field">
              <span className="field-label">API anahtarı</span>
              <input
                className="input"
                type="password"
                autoComplete="off"
                placeholder="sk-…"
                defaultValue={ayarlar.llmAnahtar ?? ''}
                onBlur={(e) =>
                  void ayarlariGuncelle({ llmAnahtar: e.target.value.trim() })
                }
              />
              <span className="field-hint">
                Anahtar yalnızca bu cihazda saklanır. Uç noktanız tarayıcı
                (CORS) çağrısına izin vermelidir.
              </span>
            </label>
          </>
        ) : null}
      </section>

      {/* Yedekleme */}
      <section className="card form-card">
        <p className="ayar-baslik">Yedekleme</p>
        <p className="field-hint">
          Tüm veriniz bu cihazda saklanır. Düzenli yedek alın; tarayıcı verisi
          silinirse yedekten geri yükleyebilirsiniz. Parola girerseniz yedek
          şifrelenir — müvekkil verisi cihaz dışına yalnızca şifreli çıkar.
          {ayarlar.sonYedeklemeZamani
            ? ` Son yedek: ${goreliZaman(ayarlar.sonYedeklemeZamani)}.`
            : ''}
        </p>
        <label className="field">
          <span className="field-label">Yedek parolası (isteğe bağlı)</span>
          <input
            type="password"
            className="input"
            value={yedekParola}
            placeholder="Boş bırakılırsa şifresiz"
            onChange={(e) => setYedekParola(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <input
          ref={dosyaGirisRef}
          type="file"
          accept="application/json,.jcenc"
          aria-label="Yedek dosyası seç"
          tabIndex={-1}
          style={{ display: 'none' }}
          onChange={(e) => void geriYukle(e.target.files?.[0])}
        />
        <div className="form-actions">
          <button
            type="button"
            className="button-primary"
            onClick={() => void yedegiIndir(yedekParola || undefined)}
          >
            {yedekParola ? 'Şifreli yedek indir' : 'Yedek indir'}
          </button>
          <button
            type="button"
            className="button-quiet"
            onClick={() => dosyaGirisRef.current?.click()}
          >
            Geri yükle
          </button>
        </div>

        {bekleyenGeriYukleme ? (
          <div className="inline-form" style={{ padding: 0 }}>
            <p className="field-hint">Bu yedek şifreli. Parolayı girin:</p>
            <input
              type="password"
              className="input"
              value={geriYuklemeParola}
              onChange={(e) => setGeriYuklemeParola(e.target.value)}
              autoComplete="off"
            />
            <div className="form-actions">
              <button
                type="button"
                className="button-primary"
                onClick={() => void sifreliGeriYukle()}
              >
                Çöz ve geri yükle
              </button>
              <button
                type="button"
                className="button-quiet"
                onClick={() => {
                  setBekleyenGeriYukleme(null)
                  setGeriYuklemeParola('')
                }}
              >
                Vazgeç
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* Güvenlik — uygulama kilidi */}
      <section className="card form-card">
        <p className="ayar-baslik">Güvenlik</p>

        {!ayarlar.kilitEtkin && !pinFormu ? (
          <>
            <p className="field-hint">
              Uygulama kilidi, telefonunuz başkasının eline geçtiğinde meslek
              sırrınız için bir engeldir: açılışta ve arka planda kaldıktan sonra
              PIN sorar, arka plandayken içerik maskelenir.
            </p>
            <button
              type="button"
              className="button-primary"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setPinFormu(true)}
            >
              PIN belirle
            </button>
          </>
        ) : null}

        {pinFormu ? (
          <>
            <label className="field">
              <span className="field-label">PIN (en az 4 rakam)</span>
              <input
                type="password"
                inputMode="numeric"
                className="input"
                value={pin1}
                onChange={(e) =>
                  setPin1(e.target.value.replace(/\D/g, '').slice(0, 8))
                }
                autoComplete="new-password"
              />
            </label>
            <label className="field">
              <span className="field-label">PIN tekrar</span>
              <input
                type="password"
                inputMode="numeric"
                className="input"
                value={pin2}
                onChange={(e) =>
                  setPin2(e.target.value.replace(/\D/g, '').slice(0, 8))
                }
                autoComplete="new-password"
              />
            </label>
            {pinHata ? <p className="field-error" role="alert">{pinHata}</p> : null}
            <div className="form-actions">
              <button
                type="button"
                className="button-primary"
                onClick={() => void pinKur()}
              >
                Kilidi aç
              </button>
              <button
                type="button"
                className="button-quiet"
                onClick={() => {
                  setPinFormu(false)
                  setPin1('')
                  setPin2('')
                  setPinHata(null)
                }}
              >
                Vazgeç
              </button>
            </div>
          </>
        ) : null}

        {ayarlar.kilitEtkin && !pinFormu ? (
          <>
            <div className="switch-row" aria-disabled="true">
              <span>
                <span style={{ display: 'block' }}>Uygulama kilidi açık</span>
                <span className="field-hint">
                  Açılışta ve arka plandan {ayarlar.oturumZamanAsimiDk ?? 5} dk
                  sonra PIN sorulur.
                </span>
              </span>
              <span
                className="kanal-rozet"
                style={{
                  background: 'var(--cat-green-bg)',
                  color: 'var(--cat-green-fg)',
                }}
              >
                Açık
              </span>
            </div>
            <label className="field">
              <span className="field-label">Arka planda kilitlenme süresi</span>
              <select
                className="select"
                value={ayarlar.oturumZamanAsimiDk ?? 5}
                onChange={(e) =>
                  void ayarlariGuncelle({
                    oturumZamanAsimiDk: Number(e.target.value),
                  })
                }
              >
                <option value={0}>Hemen</option>
                <option value={1}>1 dakika</option>
                <option value={5}>5 dakika</option>
                <option value={15}>15 dakika</option>
              </select>
            </label>

            {ayarlar.biyometriKimlikB64 ? (
              <div className="switch-row">
                <span>
                  <span style={{ display: 'block' }}>
                    Face ID / Touch ID ile açış
                  </span>
                  <span className="field-hint">
                    Kilit ekranında yüzünüz ya da parmağınızla hızlı açış açık.
                  </span>
                </span>
                <button
                  type="button"
                  className="button-quiet"
                  onClick={() => void biyometriKapat()}
                >
                  Kapat
                </button>
              </div>
            ) : biyometriVar ? (
              <div className="switch-row">
                <span>
                  <span style={{ display: 'block' }}>
                    Face ID / Touch ID ile açış
                  </span>
                  <span className="field-hint">
                    Her seferinde PIN yerine cihazınızın biyometrisiyle açın.
                  </span>
                </span>
                <button
                  type="button"
                  className="button-quiet"
                  onClick={() => void biyometriAc()}
                >
                  Etkinleştir
                </button>
              </div>
            ) : null}

            <div className="form-actions">
              <button
                type="button"
                className="button-quiet"
                onClick={() => setPinFormu(true)}
              >
                PIN’i değiştir
              </button>
              <button
                type="button"
                className="button-danger"
                onClick={() => void kilidiKaldir()}
              >
                Kilidi kaldır
              </button>
            </div>
          </>
        ) : null}

        <p className="field-hint">
          Uygulama KVKK’ya uygun tasarlanmıştır: müvekkil verisi cihazdan dışarı
          çıkmaz, üçüncü taraf analitiği yoktur. Cihazınızın kendi disk
          şifrelemesi (iOS’ta varsayılan açık) verinizi donanım düzeyinde korur.
        </p>
      </section>

      {/* Yardım — uygulama turu */}
      <section className="card form-card">
        <p className="ayar-baslik">Yardım</p>
        <p className="field-hint">
          Uygulamayı ilk açtığınızda gösterilen rehberli turu istediğiniz zaman
          yeniden başlatabilirsiniz; tur gerçek panelleri gezerek özellikleri
          doğal konumlarında gösterir.
        </p>
        <button
          type="button"
          className="button-quiet"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => {
            void ayarlariGuncelle({ turGoruldu: false })
            setMesaj('Uygulama turu yeniden başlatıldı.')
          }}
        >
          Uygulama turunu yeniden başlat
        </button>
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
        JurisCalendar · sürüm {__APP_VERSION__} ({__BUILD_ID__}) · veriler
        cihazınızda saklanır.
      </p>
    </>
  )
}
