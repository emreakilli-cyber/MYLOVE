import { useEffect, useRef } from 'react'
import { Icon } from './Icon'
import {
  isTipiEtiketleri,
  masaustuErisilebilir,
  sureMetni,
  sureTahminiMs,
  telefonTercihiKur,
  type IsTipi,
} from '../services/devir'

/*
 * Devir teslim penceresi. Yalnızca masaüstü erişilebilirken gösterilir (aksi
 * hâlde çağıran taraf hiç açmaz, iş sessizce telefonda yapılır). "Telefonda yap"
 * her zaman vardır ve VARSAYILAN vurgulu butondur. Süre tahmini yalnızca gerçek
 * ölçüm varsa gösterilir.
 */

interface DevirTeslimProps {
  readonly isTipi: IsTipi
  readonly onTelefon: () => void
  readonly onMasaustu: () => void
  readonly onKapat: () => void
}

export function DevirTeslim({
  isTipi,
  onTelefon,
  onMasaustu,
  onKapat,
}: DevirTeslimProps) {
  const tahmin = sureMetni(sureTahminiMs(isTipi))
  const pencereRef = useRef<HTMLDivElement>(null)

  // aria-modal="true" sözünü davranışla eşle: odağı pencereye al, Esc ile kapat,
  // Tab'ı pencere içinde döndür, kapanınca odağı geri ver (Drawer ile aynı desen).
  useEffect(() => {
    const oncekiOdak = document.activeElement as HTMLElement | null
    const ilkButon =
      pencereRef.current?.querySelector<HTMLElement>('button:not([disabled])')
    ilkButon?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onKapat()
        return
      }
      if (event.key !== 'Tab') return
      const odaklanabilir = pencereRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      )
      if (!odaklanabilir || odaklanabilir.length === 0) return
      const ilk = odaklanabilir[0]
      const son = odaklanabilir[odaklanabilir.length - 1]
      if (!ilk || !son) return
      if (event.shiftKey && document.activeElement === ilk) {
        event.preventDefault()
        son.focus()
      } else if (!event.shiftKey && document.activeElement === son) {
        event.preventDefault()
        ilk.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      oncekiOdak?.focus()
    }
  }, [onKapat])

  return (
    <div
      className="onizleme-katman"
      role="dialog"
      aria-modal="true"
      aria-label="İşi nerede yapmak istersiniz?"
      onClick={onKapat}
    >
      <div
        ref={pencereRef}
        className="devir-pencere"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="ob-etiket">İŞ BÖLÜMÜ</p>
        <h2 className="devir-baslik">{isTipiEtiketleri[isTipi]}</h2>
        <p className="devir-metin">Bu işi nerede yapmak istersiniz?</p>

        <button
          type="button"
          className="ob-cta ob-cta-buyuk devir-telefon"
          onClick={() => {
            telefonTercihiKur(isTipi)
            onTelefon()
          }}
        >
          <Icon name="check" size={16} /> Telefonda yap
          {tahmin ? <span className="devir-tahmin">{tahmin}</span> : null}
        </button>

        {masaustuErisilebilir() ? (
          <button
            type="button"
            className="button-quiet devir-masaustu"
            onClick={onMasaustu}
          >
            Bilgisayara aktar
          </button>
        ) : null}

        <p className="field-hint devir-not">
          Bilgisayarınız kapalıyken de her şey telefonda çalışır.
        </p>
      </div>
    </div>
  )
}
