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

  return (
    <div
      className="onizleme-katman"
      role="dialog"
      aria-modal="true"
      aria-label="İşi nerede yapmak istersiniz?"
      onClick={onKapat}
    >
      <div
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
