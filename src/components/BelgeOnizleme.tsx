import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { belgeyiIndir, boyutMetni } from '../data/belgeIslemleri'
import type { Belge } from '../domain/types'

/*
 * Belge önizleme penceresi. İçerik cihazdaki Blob'tan bir object URL ile
 * gösterilir — ağdan bir şey çekilmez. Görsel ve PDF gömülü açılır, ses
 * çalınır; önizlenemeyen türlerde indirmeye yönlendirir.
 *
 * Object URL bileşen kapanınca serbest bırakılır; aksi hâlde bellek sızar.
 */

interface BelgeOnizlemeProps {
  readonly belge: Belge
  readonly onKapat: () => void
}

export function BelgeOnizleme({ belge, onKapat }: BelgeOnizlemeProps) {
  const [adres, setAdres] = useState<string | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(belge.icerik)
    setAdres(url)
    return () => URL.revokeObjectURL(url)
  }, [belge])

  // Esc ile kapat.
  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onKapat()
    }
    document.addEventListener('keydown', tus)
    return () => document.removeEventListener('keydown', tus)
  }, [onKapat])

  const mime = belge.mimeTur
  const gorsel = mime.startsWith('image/')
  const pdf = mime === 'application/pdf'
  const ses = mime.startsWith('audio/')

  return (
    <div
      className="onizleme-katman"
      role="dialog"
      aria-modal="true"
      aria-label={`${belge.ad} önizleme`}
      onClick={onKapat}
    >
      <div className="onizleme-pencere" onClick={(e) => e.stopPropagation()}>
        <header className="onizleme-bar">
          <span className="onizleme-baslik truncate">{belge.ad}</span>
          <button
            type="button"
            className="onizleme-kapat"
            onClick={onKapat}
            aria-label="Kapat"
          >
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="onizleme-govde">
          {adres === null ? (
            <p className="onizleme-bos">Yükleniyor…</p>
          ) : gorsel ? (
            <img className="onizleme-gorsel" src={adres} alt={belge.ad} />
          ) : pdf ? (
            <iframe className="onizleme-pdf" src={adres} title={belge.ad} />
          ) : ses ? (
            <audio className="onizleme-ses" src={adres} controls />
          ) : (
            <div className="onizleme-bos">
              <Icon name="folder" size={40} />
              <p>Bu tür için gömülü önizleme yok.</p>
              <p className="field-hint">{boyutMetni(belge.boyut)}</p>
            </div>
          )}
        </div>

        <footer className="onizleme-alt">
          <button
            type="button"
            className="button-quiet"
            onClick={() => belgeyiIndir(belge)}
          >
            <Icon name="arrow-up-right" size={16} />
            Cihaza indir
          </button>
        </footer>
      </div>
    </div>
  )
}
