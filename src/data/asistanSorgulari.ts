import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { dosyaBulgulari, tumBulgular, type Bulgu, type DosyaBaglami } from '../domain/asistan'

/*
 * Asistanın okuma katmanı. Bağlamı (dosya + bağlı kayıtlar) toplayıp kural
 * motoruna verir. Motorun kendisi saf; burası yalnızca veriyi taşır.
 */

async function dosyaBaglamiTopla(dosyaId: string): Promise<DosyaBaglami | null> {
  const dosya = await db.dosyalar.get(dosyaId)
  if (!dosya) return null
  const [muvekkil, olaylar, sureler, gorevler, finans, belgeler] =
    await Promise.all([
      db.muvekkiller.get(dosya.muvekkilId),
      db.olaylar.where('dosyaId').equals(dosyaId).toArray(),
      db.sureler.where('dosyaId').equals(dosyaId).toArray(),
      db.gorevler.where('dosyaId').equals(dosyaId).toArray(),
      db.finans.where('dosyaId').equals(dosyaId).toArray(),
      db.belgeler.where('dosyaId').equals(dosyaId).toArray(),
    ])
  return { dosya, muvekkil, olaylar, sureler, gorevler, finans, belgeler }
}

/** Büro genelindeki tüm bulgular (açık dosyalar). */
export function useTumBulgular(): Bulgu[] | undefined {
  return useLiveQuery(async () => {
    const dosyalar = await db.dosyalar
      .filter((d) => d.durum !== 'kapali' && !d.arsivlendi)
      .toArray()
    const baglamlar = await Promise.all(
      dosyalar.map((d) => dosyaBaglamiTopla(d.id)),
    )
    return tumBulgular(baglamlar.filter((b): b is DosyaBaglami => b !== null))
  }, [])
}

/** Tek dosyanın bulguları. */
export function useDosyaBulgulari(
  dosyaId: string | undefined,
): Bulgu[] | undefined {
  return useLiveQuery(async () => {
    if (!dosyaId) return []
    const baglam = await dosyaBaglamiTopla(dosyaId)
    return baglam ? dosyaBulgulari(baglam) : []
  }, [dosyaId])
}

/** Q&A için bir dosyanın tam bağlamını canlı getirir. */
export function useDosyaBaglami(
  dosyaId: string | undefined,
): DosyaBaglami | undefined | null {
  return useLiveQuery(async () => {
    if (!dosyaId) return null
    return dosyaBaglamiTopla(dosyaId)
  }, [dosyaId])
}
