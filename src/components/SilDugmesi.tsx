import { useEffect, useState } from 'react'
import { Icon } from './Icon'

/*
 * Satır içi silme düğmesi — iki dokunuşlu onay.
 *
 * Belge, süre, not ve ilgili kişi kayıtları GERİ ALINAMAZ silinir; belge çoğu
 * zaman dosyanın tek kopyasıdır. Tek yanlış dokunuşla (özellikle önizleme
 * düğmesinin hemen yanındaki "×") yok olmasınlar diye ilk dokunuş "Sil?"
 * onayına geçer, ikincisi siler. 3 sn içinde dokunulmazsa onay geri alınır —
 * uygulamanın başka yerdeki "Emin misiniz?" iki adımlı deseniyle aynı.
 */
export function SilDugmesi({
  onSil,
  etiket,
}: {
  readonly onSil: () => void
  readonly etiket: string
}) {
  const [onay, setOnay] = useState(false)

  useEffect(() => {
    if (!onay) return
    const t = window.setTimeout(() => setOnay(false), 3000)
    return () => window.clearTimeout(t)
  }, [onay])

  if (onay) {
    return (
      <button
        type="button"
        className="row-remove row-remove-onay"
        onClick={() => {
          setOnay(false)
          onSil()
        }}
        aria-label={`${etiket} — silmeyi onayla`}
      >
        Sil?
      </button>
    )
  }

  return (
    <button
      type="button"
      className="row-remove"
      onClick={() => setOnay(true)}
      aria-label={etiket}
    >
      <Icon name="close" size={16} />
    </button>
  )
}
