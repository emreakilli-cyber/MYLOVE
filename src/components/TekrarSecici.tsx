import { useId } from 'react'
import { MAKS_TEKRAR, tekrarEtiketleri, type TekrarSikligi } from '../domain/tekrar'

/*
 * Olay ve görev formlarının paylaştığı tekrar seçici. "Tekrar yok" varsayılan;
 * bir sıklık seçilince kaç kez tekrarlanacağı sorulur (ilk kayıt dahil).
 */

export type TekrarSecim = TekrarSikligi | 'yok'

interface TekrarSeciciProps {
  readonly siklik: TekrarSecim
  readonly adet: number
  readonly onSiklik: (s: TekrarSecim) => void
  readonly onAdet: (n: number) => void
  /** Sıklık "yok" iken gösterilecek küçük ipucu (ör. görevde vade koşulu). */
  readonly ipucu?: string
}

const SIKLIKLAR = Object.keys(tekrarEtiketleri) as TekrarSikligi[]

export function TekrarSecici({
  siklik,
  adet,
  onSiklik,
  onAdet,
  ipucu,
}: TekrarSeciciProps) {
  // Alan iki kontrol taşıdığından (sıklık + adet) tek bir <label> ile
  // saramayız; sıklık seçimini `htmlFor` ile açıkça ilişkilendiriyoruz.
  const siklikId = useId()
  return (
    <div className="field">
      <label className="field-label" htmlFor={siklikId}>
        Tekrar
      </label>
      <select
        id={siklikId}
        className="select"
        value={siklik}
        onChange={(e) => onSiklik(e.target.value as TekrarSecim)}
      >
        <option value="yok">Tekrar yok</option>
        {SIKLIKLAR.map((s) => (
          <option key={s} value={s}>
            {tekrarEtiketleri[s]}
          </option>
        ))}
      </select>

      {siklik !== 'yok' ? (
        <label className="field" style={{ marginTop: 'var(--space-3)' }}>
          <span className="field-label">Kaç kez tekrarlansın?</span>
          <input
            type="number"
            inputMode="numeric"
            min={2}
            max={MAKS_TEKRAR}
            className="input"
            value={adet}
            onChange={(e) =>
              onAdet(
                Math.max(2, Math.min(MAKS_TEKRAR, Number(e.target.value) || 2)),
              )
            }
          />
          <span className="field-hint">
            İlk kayıt dahil {adet} kez oluşturulur. Seriyi sonradan tek tek
            düzenleyebilir ya da tümünü silebilirsiniz.
          </span>
        </label>
      ) : ipucu ? (
        <span className="field-hint">{ipucu}</span>
      ) : null}
    </div>
  )
}
