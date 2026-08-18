import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { SatirIskeleti } from '../components/BolumKarti'
import { Link } from '../router'
import {
  useDosyaBaglami,
  useTumBulgular,
} from '../data/asistanSorgulari'
import { useAcikDosyalar } from '../data/olayIslemleri'
import {
  dosyaOzeti,
  onerilenSorular,
  soruyuCevapla,
  type Bulgu,
} from '../domain/asistan'
import { useAyarlar } from '../data/sorgular'
import {
  LlmHatasi,
  llmDurumu,
  llmSaglayiciAdi,
  llmSor,
} from '../services/llm'
import { devirSorulmali, sureOlc } from '../services/devir'
import { DevirTeslim } from '../components/DevirTeslim'

const oncelikEtiket: Record<Bulgu['oncelik'], string> = {
  kritik: 'Kritik',
  uyari: 'Uyarı',
  bilgi: 'Bilgi',
}

function BulguSatiri({ bulgu }: { bulgu: Bulgu }) {
  return (
    <Link to={bulgu.yol} className="bulgu">
      <span
        className="bulgu-nokta"
        data-oncelik={bulgu.oncelik}
        aria-label={oncelikEtiket[bulgu.oncelik]}
      />
      <span className="bulgu-metin">
        <span className="bulgu-mesaj">{bulgu.mesaj}</span>
        <span className="bulgu-dosya">{bulgu.dosyaBaslik}</span>
      </span>
      <Icon name="chevron-right" size={16} className="row-chevron" />
    </Link>
  )
}

export function Asistan() {
  const bulgular = useTumBulgular()
  const dosyalar = useAcikDosyalar()
  const ayarlar = useAyarlar()

  const [dosyaId, setDosyaId] = useState('')
  const [soru, setSoru] = useState('')
  const [cevap, setCevap] = useState<string | null>(null)
  const [kaynak, setKaynak] = useState<'kural' | 'llm'>('kural')
  const [llmYukleniyor, setLlmYukleniyor] = useState(false)
  const [devirAcik, setDevirAcik] = useState(false)

  const baglam = useDosyaBaglami(dosyaId || undefined)
  const llmHazir = llmDurumu(ayarlar) === 'hazir'

  // Hero özeti Gündem listesinin TAMAMINI yansıtmalı: liste kritik+uyarı tüm
  // bulguları gösteriyor, bu yüzden sayaç bulgular.length olmalı (yalnız kritik
  // olursa "4 konu" der ama altta 12 satır görünürdü). kritikSayi kırılım için.
  const bulguSayi = bulgular?.length ?? 0
  const kritikSayi = useMemo(
    () => bulgular?.filter((b) => b.oncelik === 'kritik').length ?? 0,
    [bulgular],
  )

  const sor = (metin: string) => {
    const s = metin.trim()
    if (!s) return
    setSoru(s)
    setKaynak('kural')
    if (!baglam) {
      setCevap('Önce bir dosya seçin, sonra sorunuzu yanıtlayayım.')
      return
    }
    setCevap(soruyuCevapla(baglam, s))
  }

  // AI ile taslak "uzun dilekçe" işidir; masaüstü erişilebilirse devir sorulur.
  const sorLlm = () => {
    const s = soru.trim()
    if (!s || !ayarlar) return
    if (!baglam) {
      setKaynak('kural')
      setCevap('Önce bir dosya seçin.')
      return
    }
    if (devirSorulmali('uzun-dilekce')) {
      setDevirAcik(true)
      return
    }
    void sorLlmCalistir()
  }

  const sorLlmCalistir = async () => {
    const s = soru.trim()
    if (!s || !ayarlar || !baglam) return
    setLlmYukleniyor(true)
    setCevap(null)
    const baslangic = performance.now()
    try {
      const metin = await llmSor(ayarlar, dosyaOzeti(baglam), s)
      sureOlc('uzun-dilekce', performance.now() - baslangic) // gerçek ölçüm
      setKaynak('llm')
      setCevap(metin)
    } catch (e) {
      setKaynak('kural')
      setCevap(
        e instanceof LlmHatasi ? e.message : 'Yapay zekâ yanıtı alınamadı.',
      )
    } finally {
      setLlmYukleniyor(false)
    }
  }

  return (
    <>
      <section className="card asistan-hero">
        <div className="safety-ring" aria-hidden="true" />
        <div className="safety-body">
          <Icon name="sparkles" size={24} className="asistan-hero-icon" />
          <h1 className="t-title asistan-hero-title">Asistan</h1>
          <p className="asistan-hero-text">
            {bulguSayi === 0
              ? 'Dosyalarınızı tarayıp yaklaşan süreleri ve eksik işlemleri önünüze koyarım. Değerlendirme cihazınızda, kendi verinizden yapılır.'
              : kritikSayi > 0
                ? `Dikkat gerektiren ${bulguSayi} konu var; ${kritikSayi} tanesi kritik. Aşağıda önceliğe göre sıraladım.`
                : `Dikkat gerektiren ${bulguSayi} konu var. Aşağıda önceliğe göre sıraladım.`}
          </p>
        </div>
      </section>

      {/* Büro geneli bulgular */}
      <section className="card section-card">
        <div className="section-head">
          <div>
            <p className="t-label section-eyebrow">Dikkat edin</p>
            <h2 className="t-title">Gündem</h2>
          </div>
        </div>
        {bulgular === undefined ? (
          <SatirIskeleti adet={4} />
        ) : bulgular.length === 0 ? (
          <p className="section-empty">
            Şu an dikkat gerektiren bir konu görünmüyor. Dosyalarınız düzenli.
          </p>
        ) : (
          <div className="divide-rows">
            {/* Hiçbir bulgu gizlenmez: Asistan tam gözden geçirme ekranıdır,
                eksik bir hukuki iş kaçmasın diye tümü listelenir (hero sayacı da
                bulgular.length; ikisi tutarlı). Bulgular önceliğe göre sıralı. */}
            {bulgular.map((b) => (
              <BulguSatiri key={b.id} bulgu={b} />
            ))}
          </div>
        )}
      </section>

      {/* Soru–cevap */}
      <section className="card section-card" data-tur="asistan">
        <div className="section-head">
          <div>
            <p className="t-label section-eyebrow">Sorun</p>
            <h2 className="t-title">Dosyaya danışın</h2>
          </div>
        </div>

        <div className="qa-form">
          <select
            className="select"
            aria-label="Danışılacak dosya"
            value={dosyaId}
            onChange={(e) => {
              setDosyaId(e.target.value)
              setCevap(null)
            }}
          >
            <option value="">Dosya seçin</option>
            {(dosyalar ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.baslik}
                {d.esasNo ? ` — ${d.esasNo}` : ''}
              </option>
            ))}
          </select>

          <div className="qa-suggestions">
            {onerilenSorular.map((q) => (
              <button
                key={q}
                type="button"
                className="qa-chip"
                disabled={!dosyaId}
                onClick={() => sor(q)}
              >
                {q}
              </button>
            ))}
          </div>

          <input
            className="input"
            aria-label="Sorunuz"
            value={soru}
            placeholder="Kendi sorunuzu yazın…"
            disabled={!dosyaId}
            onChange={(e) => setSoru(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') sor(soru)
            }}
          />
          <div className="qa-actions">
            <button
              type="button"
              className="button-primary"
              disabled={!dosyaId || !soru.trim() || llmYukleniyor}
              onClick={() => sor(soru)}
            >
              Sor
            </button>
            {llmHazir ? (
              <button
                type="button"
                className="button-quiet"
                disabled={!dosyaId || !soru.trim() || llmYukleniyor}
                onClick={() => void sorLlm()}
              >
                <Icon name="sparkles" size={15} />
                {llmYukleniyor ? 'Yanıtlanıyor…' : 'Yapay zekâya sor'}
              </button>
            ) : null}
          </div>
        </div>

        {cevap ? (
          <div className="qa-answer">
            <p className="qa-answer-label">
              <Icon name="sparkles" size={13} />
              {kaynak === 'llm'
                ? `Yapay zekâ · ${llmSaglayiciAdi(ayarlar)}`
                : 'Asistan'}
            </p>
            {cevap}
            {kaynak === 'llm' ? (
              <p className="qa-answer-not">
                Bu yanıt için sorunuz ve dosya özeti {llmSaglayiciAdi(ayarlar)}{' '}
                adresine gönderildi.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <p className="t-small t-muted" style={{ padding: '0 var(--space-1)' }}>
        Asistan cihazdaki veriyi kurallara göre değerlendirir; hukuki tavsiye
        vermez ve süre teyidi kullanıcının sorumluluğundadır. Yapay zekâ (LLM)
        katmanı isteğe bağlıdır ve varsayılan olarak kapalıdır; Ayarlar’dan kendi
        anahtarınızla açabilirsiniz — açıkken yalnızca sorunuz ve dosya özeti
        gönderilir.
      </p>

      {devirAcik ? (
        <DevirTeslim
          isTipi="uzun-dilekce"
          onTelefon={() => {
            setDevirAcik(false)
            void sorLlmCalistir()
          }}
          onMasaustu={() => {
            setDevirAcik(false)
            setKaynak('kural')
            setCevap('Bilgisayara aktarma henüz bağlanmadı; iş telefonda yapılır.')
          }}
          onKapat={() => setDevirAcik(false)}
        />
      ) : null}
    </>
  )
}
