import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import {
  demoDava,
  isBolumu,
  korunanParcalar,
  maskeParcalari,
  ozetMaddeleri,
  sahneler,
  type SahneTanim,
} from './script'
import { tikSesi, titret } from './efektler'

/*
 * Öğretici mod oynatıcısı. Sahne metni/zamanı `script.ts`'ten gelir; burada yalnızca
 * oynatma mantığı ve görsel var. Hiçbir gerçek modül çağrılmaz; demo verisi DB'ye
 * yazılmaz. Her sahnede "Atla" vardır ve doğrudan bitişe (onay ekranına) gider.
 */

interface OnboardingProps {
  /** Akış tamamlanınca ya da atlanınca çağrılır (onay ekranına geçilir). */
  readonly onBitti: () => void
  readonly sesli?: boolean
  readonly titresimli?: boolean
}

export function Onboarding({
  onBitti,
  sesli = true,
  titresimli = true,
}: OnboardingProps) {
  const [i, setI] = useState(0)
  const sahne = sahneler[i]

  const ilerle = useCallback(() => {
    setI((n) => {
      if (n >= sahneler.length - 1) {
        onBitti()
        return n
      }
      return n + 1
    })
  }, [onBitti])

  const tikla = useCallback(() => {
    tikSesi(sesli)
    titret(titresimli)
  }, [sesli, titresimli])

  // Etkileşimsiz sahneler kendiliğinden ilerler.
  useEffect(() => {
    if (!sahne || sahne.zaman.etkilesimli) return
    const t = setTimeout(ilerle, sahne.zaman.sure)
    return () => clearTimeout(t)
  }, [i, sahne, ilerle])

  if (!sahne) return null

  return (
    <div className="ob" role="dialog" aria-label="JurisCalendar tanıtımı">
      <div className="ob-ust">
        <span className="ob-adim" aria-hidden="true">
          {i + 1}/{sahneler.length}
        </span>
        <button
          type="button"
          className="ob-atla"
          onClick={() => {
            tikla()
            onBitti()
          }}
        >
          Atla
        </button>
      </div>

      <div className="ob-govde" key={sahne.id}>
        <p className="ob-etiket">{sahne.etiket}</p>
        <h1 className="ob-baslik">{sahne.baslik}</h1>
        {sahne.metin ? <p className="ob-metin">{sahne.metin}</p> : null}

        <SahneGovdesi sahne={sahne} ilerle={ilerle} tikla={tikla} onBitti={onBitti} />
      </div>

      <div className="ob-noktalar" aria-hidden="true">
        {sahneler.map((s, n) => (
          <span key={s.id} className="ob-nokta" data-aktif={n === i} />
        ))}
      </div>
    </div>
  )
}

function SahneGovdesi({
  sahne,
  ilerle,
  tikla,
  onBitti,
}: {
  sahne: SahneTanim
  ilerle: () => void
  tikla: () => void
  onBitti: () => void
}) {
  switch (sahne.id) {
    case 's0':
      return <Sahne0 />
    case 's1':
      return <Sahne1 />
    case 's2':
      return <Sahne2 />
    case 's3':
      return <Sahne3 ilerle={ilerle} tikla={tikla} />
    case 's4':
      return <Sahne4 ilerle={ilerle} tikla={tikla} />
    case 's5':
      return <Sahne5 ilerle={ilerle} tikla={tikla} />
    case 's6':
      return <MaskeSahnesi ilerle={ilerle} tikla={tikla} />
    case 'neyi-nerede':
      return <NeyiNerede />
    case 's7':
      return (
        <Sahne7
          onBasla={() => {
            tikla()
            onBitti()
          }}
        />
      )
  }
}

/* ---- S0: bulut → telefon ---- */
function Sahne0() {
  return (
    <div className="ob-orta">
      <span className="ob-logo">J</span>
      <div className="ob-bulut-telefon" aria-hidden="true">
        <span className="ob-bulut">
          <Icon name="close" size={54} className="ob-bulut-cizik" />
          ☁
        </span>
        <span className="ob-telefon">📱</span>
      </div>
    </div>
  )
}

/* ---- S1: kendi kendine dolan form ---- */
function Sahne1() {
  const alanlar: Array<[string, string]> = [
    ['Müvekkil', demoDava.muvekkil],
    ['Karşı taraf', demoDava.karsiTaraf],
    ['Esas no', demoDava.esasNo],
    ['Konu', demoDava.konu],
    ['Duruşma', demoDava.durusma],
    ['Alacak', `${demoDava.tutar} (tahsil edilmedi)`],
  ]
  const [gorunen, setGorunen] = useState(0)
  useEffect(() => {
    if (gorunen >= alanlar.length) return
    const t = setTimeout(() => setGorunen((n) => n + 1), 650)
    return () => clearTimeout(t)
  }, [gorunen, alanlar.length])

  return (
    <div className="ob-form">
      {alanlar.map(([etiket, deger], n) => (
        <div className="ob-form-satir" key={etiket} data-dolu={n < gorunen}>
          <span className="ob-form-etiket">{etiket}</span>
          <span className="ob-form-deger">{n < gorunen ? deger : ''}</span>
        </div>
      ))}
    </div>
  )
}

/* ---- S2: geri sayım halkası ---- */
function Sahne2() {
  const [dolu, setDolu] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setDolu(true), 200)
    return () => clearTimeout(t)
  }, [])
  const r = 42
  const cevre = 2 * Math.PI * r
  return (
    <div className="ob-orta">
      <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#ece9e4" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--brand-teal)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={cevre}
          strokeDashoffset={dolu ? cevre * 0.15 : cevre}
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 2.4s var(--ease-out)' }}
        />
        <text x="60" y="58" textAnchor="middle" className="ob-halka-sayi">
          38
        </text>
        <text x="60" y="74" textAnchor="middle" className="ob-halka-alt">
          gün
        </text>
      </svg>
    </div>
  )
}

/* ---- S3: ücret takibi, telefon ikonuna dokun ---- */
function Sahne3({ ilerle, tikla }: { ilerle: () => void; tikla: () => void }) {
  const [durum, setDurum] = useState<'bekle' | 'arıyor' | 'not'>('bekle')
  useEffect(() => {
    if (durum === 'arıyor') {
      const t = setTimeout(() => setDurum('not'), 1400)
      return () => clearTimeout(t)
    }
    if (durum === 'not') {
      const t = setTimeout(ilerle, 1600)
      return () => clearTimeout(t)
    }
  }, [durum, ilerle])

  return (
    <div className="ob-orta">
      <div className="ob-ucret" data-acik={durum !== 'bekle'}>
        <span className="ob-ucret-metin">
          {demoDava.tutar} · <strong>62 gündür tahsil edilmedi</strong>
        </span>
        {durum === 'bekle' ? (
          <button
            type="button"
            className="ob-telefon-tus ob-parla"
            aria-label="Müvekkili ara"
            onClick={() => {
              tikla()
              setDurum('arıyor')
            }}
          >
            <Icon name="phone" size={24} />
          </button>
        ) : null}
      </div>
      {durum === 'arıyor' ? (
        <p className="ob-durum">Aranıyor… {demoDava.muvekkil}</p>
      ) : null}
      {durum === 'not' ? (
        <p className="ob-durum ob-durum-ok">
          <Icon name="check" size={15} /> Görüşme dosyaya not düşüldü
        </p>
      ) : null}
    </div>
  )
}

/* ---- S4: acil iş, AI Asistan'a yaz ---- */
function Sahne4({ ilerle, tikla }: { ilerle: () => void; tikla: () => void }) {
  return (
    <div className="ob-orta">
      <div className="ob-bildirim">
        <Icon name="bell" size={18} />
        <span>Karşı taraf cevap dilekçesi sundu — beyan için 6 gün</span>
      </div>
      <button
        type="button"
        className="ob-cta"
        onClick={() => {
          tikla()
          ilerle()
        }}
      >
        <Icon name="sparkles" size={16} /> AI Asistan’a Yaz
      </button>
    </div>
  )
}

/* ---- S5: mesaj yazılır, dosya eklenir, Gönder ---- */
function Sahne5({ ilerle, tikla }: { ilerle: () => void; tikla: () => void }) {
  const tamMetin =
    'Bu dosyada karşı tarafın cevabına beyan dilekçesi hazırla. Süre 6 gün.'
  const [yazi, setYazi] = useState('')
  const [ekli, setEkli] = useState(false)
  useEffect(() => {
    if (yazi.length < tamMetin.length) {
      const t = setTimeout(() => setYazi(tamMetin.slice(0, yazi.length + 1)), 28)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setEkli(true), 400)
    return () => clearTimeout(t)
  }, [yazi])

  return (
    <div className="ob-sohbet">
      <div className="ob-balon">{yazi}<span className="ob-imlec" /></div>
      {ekli ? (
        <div className="ob-ek">
          <Icon name="folder" size={14} /> {demoDava.muvekkil} · {demoDava.esasNo}
        </div>
      ) : null}
      <button
        type="button"
        className="ob-cta"
        disabled={!ekli}
        onClick={() => {
          tikla()
          ilerle()
        }}
      >
        Gönder
      </button>
    </div>
  )
}

/* ---- S6: MASKELEME (a→b→c→d) ---- */
type MaskeAdim = 'a' | 'b' | 'c' | 'd'

function MaskeSahnesi({ ilerle, tikla }: { ilerle: () => void; tikla: () => void }) {
  const [adim, setAdim] = useState<MaskeAdim>('a')
  const [maskeli, setMaskeli] = useState(0) // a: kaç parça maskelendi
  const [orijinal, setOrijinal] = useState(false) // b: geçici göster
  const [acilan, setAcilan] = useState(maskeParcalari.length) // d: kaçı ham (başta hepsi ham)
  const orijinalTimer = useRef<number | null>(null)

  // "Orijinali Göster": dokununca 1 sn gerçek metni gösterir, sonra geri döner.
  const orijinaliGoster = () => {
    setOrijinal(true)
    if (orijinalTimer.current) clearTimeout(orijinalTimer.current)
    orijinalTimer.current = window.setTimeout(() => setOrijinal(false), 1000)
  }
  useEffect(
    () => () => {
      if (orijinalTimer.current) clearTimeout(orijinalTimer.current)
    },
    [],
  )

  // Adım a: parçaları tek tek maskele.
  useEffect(() => {
    if (adim !== 'a') return
    if (maskeli >= maskeParcalari.length) {
      const t = setTimeout(() => setAdim('b'), 900)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => {
      tikla()
      setMaskeli((n) => n + 1)
    }, 700)
    return () => clearTimeout(t)
  }, [adim, maskeli, tikla])

  // Parçanın o an maskeli mi görüneceği: a'da sırayla maskelenir, d'de sırayla açılır.
  const pm = (p: number): boolean => {
    if (adim === 'a') return p < maskeli
    if (adim === 'd') return p >= maskeParcalari.length - acilan
    if (adim === 'b') return !orijinal // b: orijinal gösterilirken ham
    return true
  }

  const govde = (
    <p className="ob-dilekce">
      Müvekkilim <Parca p={0} masked={pm(0)} /> (T.C. <Parca p={1} masked={pm(1)} />
      , <Parca p={2} masked={pm(2)} />) adına; karşı taraf{' '}
      <Parca p={3} masked={pm(3)} /> ve <Parca p={4} masked={pm(4)} /> hakkında,{' '}
      <Korunan metin="İzmir" neden="yetkili mahkeme için" /> 3. Sulh Hukuk
      Mahkemesi’nin <Parca p={6} masked={pm(6)} /> dosyasında; alacağın{' '}
      <Parca p={5} masked={pm(5)} /> hesabına yatırılması ve{' '}
      <Korunan metin="14 Eylül 2026" neden="süre hesabı için" /> duruşmasında…
    </p>
  )

  if (adim === 'a') {
    return <div className="ob-maske-alan">{govde}</div>
  }

  if (adim === 'b') {
    return (
      <div className="ob-maske-alan">
        {govde}
        <div className="ob-onay">
          <p className="ob-onay-baslik">
            <Icon name="lock" size={15} />{' '}
            {orijinal
              ? 'Orijinal gösteriliyor…'
              : '7 bilgi maskelendi, kontrol edin'}
          </p>
          <div className="ob-onay-tuslar">
            <button
              type="button"
              className="button-quiet"
              aria-pressed={orijinal}
              onClick={orijinaliGoster}
            >
              Orijinali Göster
            </button>
            <button
              type="button"
              className="ob-cta"
              onClick={() => {
                tikla()
                setAdim('c')
              }}
            >
              Onayla, gönder
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (adim === 'c') {
    return (
      <div className="ob-bolunmus">
        <div className="ob-yari ob-yari-cihaz">
          <p className="ob-yari-baslik">Cihazınız</p>
          <div className="ob-kasa" title="Eşleme tablosu">
            <Icon name="lock" size={20} />
            <span>eşleme tablosu</span>
          </div>
        </div>
        <div className="ob-hat" aria-hidden="true">
          <span className="ob-hat-metin">███ ███ ███</span>
        </div>
        <div className="ob-yari ob-yari-ai">
          <p className="ob-yari-baslik">Yapay Zekâ</p>
          <p className="ob-yari-akan">{maskeliMetin()}</p>
        </div>
        <p className="ob-altyazi">
          Sağa giden: maskelenmiş metin. Cihazda kalan: kim olduğu.
        </p>
        <button
          type="button"
          className="ob-cta"
          onClick={() => {
            tikla()
            setAdim('d')
          }}
        >
          Devam
        </button>
      </div>
    )
  }

  // adım d: gerçek bilgilerle değiştir
  return (
    <div className="ob-maske-alan">
      {govde}
      {acilan > 0 ? (
        <button
          type="button"
          className="ob-cta"
          onClick={() => {
            tikla()
            setAcilan((n) => Math.max(0, n - 1))
          }}
        >
          Gerçek bilgilerle değiştir
        </button>
      ) : (
        <>
          <p className="ob-durum ob-durum-ok">
            <Icon name="check" size={15} /> Dilekçe hazır. Kimliği hiç dışarı
            çıkmadı.
          </p>
          <button type="button" className="ob-cta" onClick={() => { tikla(); ilerle() }}>
            Devam
          </button>
        </>
      )}
    </div>
  )
}

function Parca({ p, masked }: { p: number; masked: boolean }) {
  const parca = maskeParcalari[p]
  if (!parca) return null
  return masked ? (
    <span className="ob-maske" title={`${parca.etiket} maskelendi`}>
      {parca.etiket}
    </span>
  ) : (
    <span className="ob-ham">{parca.ham}</span>
  )
}

function Korunan({ metin, neden }: { metin: string; neden: string }) {
  return (
    <span className="ob-korunan">
      {metin}
      <span className="ob-korunan-etiket">{neden}</span>
    </span>
  )
}

function maskeliMetin(): string {
  const e = (i: number) => `[${maskeParcalari[i]?.etiket ?? ''}]`
  return `Müvekkilim ${e(0)} (T.C. ${e(1)}, ${e(2)}) adına; karşı taraf ${e(3)} ve ${e(4)} hakkında, ${korunanParcalar[0]?.metin} 3. Sulh Hukuk Mahkemesi’nin ${e(6)} dosyasında; alacağın ${e(5)} hesabına yatırılması ve ${korunanParcalar[1]?.metin} duruşmasında…`
}

/* ---- "Neyi nerede yaparsınız?" ---- */
function NeyiNerede() {
  const [dusen, setDusen] = useState(0)
  useEffect(() => {
    if (dusen >= isBolumu.length) return
    const t = setTimeout(() => setDusen((n) => n + 1), 850)
    return () => clearTimeout(t)
  }, [dusen])

  const telefon = isBolumu.filter((k) => k.yer === 'telefon')
  const bilgisayar = isBolumu.filter((k) => k.yer === 'bilgisayar')
  const dusenler = isBolumu.slice(0, dusen)

  return (
    <div className="ob-nerede">
      <div className="ob-nerede-sutunlar">
        <div className="ob-sutun ob-sutun-telefon">
          <p className="ob-sutun-baslik">📱 Telefon</p>
          {telefon.map((k) => (
            <div
              className="ob-is"
              key={k.is}
              data-dusen={dusenler.includes(k)}
            >
              {k.is}
            </div>
          ))}
        </div>
        <div className="ob-sutun ob-sutun-bilgisayar">
          <p className="ob-sutun-baslik">💻 Bilgisayar</p>
          {bilgisayar.map((k) => (
            <div
              className="ob-is"
              key={k.is}
              data-dusen={dusenler.includes(k)}
            >
              {k.is}
            </div>
          ))}
        </div>
      </div>
      <p className="ob-nerede-alt">Bilgisayarınız kapalıyken de çalışır.</p>
    </div>
  )
}

/* ---- S7: özet ---- */
function Sahne7({ onBasla }: { onBasla: () => void }) {
  return (
    <div className="ob-ozet">
      <ul className="ob-ozet-liste">
        {ozetMaddeleri.map((m) => (
          <li key={m.metin}>
            <span className="ob-ozet-ikon" aria-hidden="true">
              {m.ikon}
            </span>
            {m.metin}
          </li>
        ))}
      </ul>
      <button type="button" className="ob-cta ob-cta-buyuk" onClick={onBasla}>
        Devam
      </button>
    </div>
  )
}
