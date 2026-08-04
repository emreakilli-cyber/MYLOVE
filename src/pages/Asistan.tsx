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
  onerilenSorular,
  soruyuCevapla,
  type Bulgu,
} from '../domain/asistan'

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

  const [dosyaId, setDosyaId] = useState('')
  const [soru, setSoru] = useState('')
  const [cevap, setCevap] = useState<string | null>(null)

  const baglam = useDosyaBaglami(dosyaId || undefined)

  const kritikSayi = useMemo(
    () => bulgular?.filter((b) => b.oncelik === 'kritik').length ?? 0,
    [bulgular],
  )

  const sor = (metin: string) => {
    const s = metin.trim()
    if (!s) return
    setSoru(s)
    if (!baglam) {
      setCevap('Önce bir dosya seçin, sonra sorunuzu yanıtlayayım.')
      return
    }
    setCevap(soruyuCevapla(baglam, s))
  }

  return (
    <>
      <section className="card asistan-hero">
        <div className="safety-ring" aria-hidden="true" />
        <div className="safety-body">
          <Icon name="sparkles" size={24} className="asistan-hero-icon" />
          <h1 className="t-title asistan-hero-title">Asistan</h1>
          <p className="asistan-hero-text">
            {kritikSayi > 0
              ? `Dikkat gerektiren ${kritikSayi} konu var. Aşağıda önceliğe göre sıraladım.`
              : 'Dosyalarınızı tarayıp yaklaşan süreleri ve eksik işlemleri önünüze koyarım. Her şey veriden; hiçbir bilgi dışarı çıkmaz.'}
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
            {bulgular.slice(0, 12).map((b) => (
              <BulguSatiri key={b.id} bulgu={b} />
            ))}
          </div>
        )}
      </section>

      {/* Soru–cevap */}
      <section className="card section-card">
        <div className="section-head">
          <div>
            <p className="t-label section-eyebrow">Sorun</p>
            <h2 className="t-title">Dosyaya danışın</h2>
          </div>
        </div>

        <div className="qa-form">
          <select
            className="select"
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
            value={soru}
            placeholder="Kendi sorunuzu yazın…"
            disabled={!dosyaId}
            onChange={(e) => setSoru(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') sor(soru)
            }}
          />
          <button
            type="button"
            className="button-primary"
            disabled={!dosyaId || !soru.trim()}
            onClick={() => sor(soru)}
          >
            Sor
          </button>
        </div>

        {cevap ? (
          <div className="qa-answer">
            <p className="qa-answer-label">
              <Icon name="sparkles" size={13} />
              Asistan
            </p>
            {cevap}
          </div>
        ) : null}
      </section>

      <p className="t-small t-muted" style={{ padding: '0 var(--space-1)' }}>
        Asistan cihazdaki veriyi kurallara göre değerlendirir; hukuki tavsiye
        vermez ve süre teyidi kullanıcının sorumluluğundadır. Yapay zekâ (LLM)
        katmanı ileride, isteğe bağlı ve varsayılan kapalı olarak eklenecektir.
      </p>
    </>
  )
}
