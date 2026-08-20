import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { finansOzeti } from './dosyaSorgulari'
import { turkceKarsilastir } from '../domain/metin'
import type { Dosya, FinansKaydi, Muvekkil, Not } from '../domain/types'

/*
 * Müvekkil listesi ve profili.
 * Bir müvekkilin "ödeme durumu", ona bağlı tüm dosyaların finans kayıtlarından
 * toplanır: her dosyada ayrı bakılmasın, avukat tek bakışta görsün.
 */

export interface MuvekkilSatiri {
  muvekkil: Muvekkil
  acikDosya: number
  toplamDosya: number
  /** Bu müvekkile bağlı tüm dosyalardaki bekleyen ödeme (kuruş). */
  bekleyenOdeme: number
}

function kucuk(metin: string): string {
  return metin.toLocaleLowerCase('tr')
}

export function useMuvekkilListesi(
  arama: string,
): MuvekkilSatiri[] | undefined {
  return useLiveQuery(async () => {
    const [muvekkiller, dosyalar, finans] = await Promise.all([
      db.muvekkiller.filter((m) => !m.arsivlendi).toArray(),
      db.dosyalar.toArray(),
      db.finans.toArray(),
    ])

    const dosyaBazMuvekkil = new Map<string, Dosya[]>()
    for (const d of dosyalar) {
      const liste = dosyaBazMuvekkil.get(d.muvekkilId) ?? []
      liste.push(d)
      dosyaBazMuvekkil.set(d.muvekkilId, liste)
    }

    const bekleyenBazMuvekkil = new Map<string, number>()
    for (const f of finans) {
      if (!f.muvekkilId || f.odemeDurumu === 'odendi') continue
      const kalan = f.tutar - f.odenenTutar
      bekleyenBazMuvekkil.set(
        f.muvekkilId,
        (bekleyenBazMuvekkil.get(f.muvekkilId) ?? 0) + kalan,
      )
    }

    const hedef = kucuk(arama.trim())
    return muvekkiller
      .filter((m) => {
        if (!hedef) return true
        return [m.ad, m.telefon, m.eposta, m.kimlikNo, ...m.etiketler]
          .filter((x): x is string => Boolean(x))
          .some((alan) => kucuk(alan).includes(hedef))
      })
      .map((muvekkil) => {
        const kendiDosyalari = dosyaBazMuvekkil.get(muvekkil.id) ?? []
        return {
          muvekkil,
          acikDosya: kendiDosyalari.filter(
            (d) => d.durum !== 'kapali' && !d.arsivlendi,
          ).length,
          toplamDosya: kendiDosyalari.length,
          bekleyenOdeme: bekleyenBazMuvekkil.get(muvekkil.id) ?? 0,
        }
      })
      .sort((a, b) => turkceKarsilastir(a.muvekkil.ad, b.muvekkil.ad))
  }, [arama])
}

/* ------------------------------------------------------------------ *
 * Profil
 * ------------------------------------------------------------------ */

export interface MuvekkilProfili {
  muvekkil: Muvekkil
  dosyalar: Dosya[]
  finansOzet: ReturnType<typeof finansOzeti>
  notlar: Not[]
}

export function useMuvekkilProfili(
  id: string | undefined,
): MuvekkilProfili | undefined | null {
  return useLiveQuery(async () => {
    if (!id) return null
    const muvekkil = await db.muvekkiller.get(id)
    if (!muvekkil) return null

    const [dosyalar, finans, notlar] = await Promise.all([
      db.dosyalar.where('muvekkilId').equals(id).toArray(),
      db.finans.where('muvekkilId').equals(id).toArray(),
      db.notlar.where('muvekkilId').equals(id).toArray(),
    ])

    return {
      muvekkil,
      dosyalar: dosyalar.sort((a, b) => {
        // Açık dosyalar önce, sonra açılış tarihine göre yeni→eski.
        const aAcik = a.durum !== 'kapali' ? 0 : 1
        const bAcik = b.durum !== 'kapali' ? 0 : 1
        return aAcik - bAcik || b.acilisTarihi.localeCompare(a.acilisTarihi)
      }),
      finansOzet: finansOzeti(finans as FinansKaydi[]),
      notlar: notlar.sort((a, b) =>
        b.olusturmaTarihi.localeCompare(a.olusturmaTarihi),
      ),
    }
  }, [id])
}

export const muvekkilTurEtiketleri: Record<Muvekkil['tur'], string> = {
  gercek: 'Gerçek kişi',
  tuzel: 'Tüzel kişi',
}
