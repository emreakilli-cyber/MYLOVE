import { useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { aydinlatmaMetni, onayMaddeleri } from './hukukiMetin'
import { onayKaydet } from '../data/onayIslemleri'

/*
 * Hukuki onay ekranı (onboarding S8). Atlanamaz. Kutular, uzun metin sonuna
 * kaydırılmadan aktifleşmez; beşi de işaretlenmeden "Kabul et" açılmaz. Onay;
 * tarih/saat, metin sürümü ve hash'iyle cihaza yazılır.
 */

interface HukukiOnayProps {
  readonly onOnaylandi: () => void
}

export function HukukiOnay({ onOnaylandi }: HukukiOnayProps) {
  const [okundu, setOkundu] = useState(false)
  const [isaretli, setIsaretli] = useState<boolean[]>(
    () => onayMaddeleri.map(() => false),
  )
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const metinRef = useRef<HTMLDivElement>(null)

  const kaydir = () => {
    const el = metinRef.current
    if (!el) return
    // 8 px tolerans: sona yakınsa "okundu" say.
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setOkundu(true)
  }

  const hepsiIsaretli = isaretli.every(Boolean)
  const aktif = okundu && hepsiIsaretli && !kaydediliyor

  const degistir = (i: number) => {
    if (!okundu) return
    setIsaretli((o) => o.map((v, n) => (n === i ? !v : v)))
  }

  const kabulEt = async () => {
    if (!aktif) return
    setKaydediliyor(true)
    try {
      await onayKaydet()
      onOnaylandi()
    } finally {
      setKaydediliyor(false)
    }
  }

  return (
    <div className="ob onay-ekran" role="dialog" aria-label="Hukuki onay">
      <div className="ob-ust">
        <span className="ob-adim">Onay</span>
      </div>

      <div className="onay-govde">
        <p className="ob-etiket">SON ADIM</p>
        <h1 className="ob-baslik onay-baslik-h">Başlamadan önce onaylayın</h1>

        <div
          className="onay-metin"
          ref={metinRef}
          onScroll={kaydir}
          tabIndex={0}
          role="region"
          aria-label="Kullanım Şartları ve Aydınlatma Metni"
        >
          {aydinlatmaMetni}
        </div>
        {!okundu ? (
          <p className="onay-ipucu">
            <Icon name="chevron-down" size={14} /> Kutuları işaretlemek için metni
            sonuna kadar kaydırın.
          </p>
        ) : null}

        <ul className="onay-liste">
          {onayMaddeleri.map((madde, i) => (
            <li key={madde}>
              <label className="onay-kutu" data-pasif={!okundu}>
                <input
                  type="checkbox"
                  checked={isaretli[i] ?? false}
                  disabled={!okundu}
                  onChange={() => degistir(i)}
                />
                <span className="onay-kutu-kare" aria-hidden="true">
                  {isaretli[i] ? <Icon name="check" size={14} /> : null}
                </span>
                <span className="onay-kutu-metin">{madde}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="onay-alt">
        <button
          type="button"
          className="ob-cta ob-cta-buyuk"
          disabled={!aktif}
          onClick={() => void kabulEt()}
        >
          {kaydediliyor ? 'Kaydediliyor…' : 'Kabul et ve başla'}
        </button>
      </div>
    </div>
  )
}
