import { db, simdi, yeniId } from './db'
import type { SureSonucu } from '../domain/sureHesabi'

/*
 * Hesaplanan süreyi dosyaya ve (istenirse) takvime yazar.
 *
 * Takvime yazılan olay `kaynak: 'sure-hesabi'` ve `sureId` taşır: süre silinirse
 * bağlı takvim kaydı da temizlenebilsin, kullanıcı da bunun elle değil motordan
 * geldiğini görsün.
 */

export interface SureKaydetSecenekleri {
  dosyaId: string
  sonuc: SureSonucu
  takvimeEkle: boolean
  not?: string
}

export async function sureKaydet({
  dosyaId,
  sonuc,
  takvimeEkle,
  not,
}: SureKaydetSecenekleri): Promise<string> {
  const zaman = simdi()
  const sureId = yeniId()
  const dosya = await db.dosyalar.get(dosyaId)

  await db.sureler.add({
    id: sureId,
    dosyaId,
    kuralId: sonuc.kural.id,
    kuralAdi: sonuc.kural.ad,
    kanunReferansi: sonuc.kural.kanun,
    baslangicTarihi: sonuc.baslangic,
    hamSonTarih: sonuc.hamSonTarih,
    sonTarih: sonuc.sonTarih,
    ...(sonuc.gerekceler.length > 0
      ? { kaydirmaGerekcesi: sonuc.gerekceler.join(' ') }
      : {}),
    durum: 'acik',
    ...(not?.trim() ? { not: not.trim() } : {}),
    olusturmaTarihi: zaman,
    guncellemeTarihi: zaman,
  })

  let olayId: string | undefined
  if (takvimeEkle) {
    olayId = yeniId()
    // Son gün tüm gün bir kayıt; saat taşımaz.
    await db.olaylar.add({
      id: olayId,
      baslik: sonuc.kural.ad,
      tur: 'son-tarih',
      dosyaId,
      ...(dosya ? { muvekkilId: dosya.muvekkilId } : {}),
      baslangic: `${sonuc.sonTarih}T00:00:00.000Z`,
      tumGun: true,
      aciklama: `${sonuc.kural.kanun} · ${sonuc.baslangic} tarihinden hesaplandı.`,
      durum: 'planlandi',
      kaynak: 'sure-hesabi',
      sureId,
      olusturmaTarihi: zaman,
      guncellemeTarihi: zaman,
    })
    // Süreyi olaya da bağla.
    await db.sureler.update(sureId, { olayId })
  }

  await db.hareketler.add({
    id: yeniId(),
    tur: 'sure-hesaplandi',
    baslik: 'Süre hesaplandı',
    ayrinti: dosya
      ? `${sonuc.kural.ad} · ${dosya.baslik}`
      : sonuc.kural.ad,
    dosyaId,
    zaman,
  })

  return sureId
}

/** Süreyi ve ona bağlı takvim olayını birlikte siler. */
export async function sureSil(id: string): Promise<void> {
  const sure = await db.sureler.get(id)
  await db.transaction('rw', [db.sureler, db.olaylar], async () => {
    await db.sureler.delete(id)
    if (sure?.olayId) await db.olaylar.delete(sure.olayId)
  })
}

/** Süreyi tamamlandı/açık arasında değiştirir. */
export async function sureDurumDegistir(
  id: string,
  durum: 'acik' | 'tamamlandi',
): Promise<void> {
  await db.sureler.update(id, { durum, guncellemeTarihi: simdi() })
}
