import { db, simdi, yeniId } from './db'
import type { SureSonucu } from '../domain/sureHesabi'

/*
 * Hesaplanan süreyi dosyaya yazar.
 *
 * Süre kaydının kendisi takvimde, hatırlatmalarda ve ICS dışa aktarımda
 * doğrudan `sureler` tablosundan gösterilir (bkz. `takvimSorgulari`,
 * `hatirlatmaSorgulari`, `services/ics`). Bu yüzden ayrı bir `son-tarih` takvim
 * OLAYI ÜRETİLMEZ: üretilirse aynı son gün her yerde iki kez çıkardı — takvimde
 * çift satır, iki bildirim (03:00 ve 09:00), iki VEVENT. Son tarih tek kaynaktan
 * (süre) yönetilir.
 */

export interface SureKaydetSecenekleri {
  dosyaId: string
  sonuc: SureSonucu
  not?: string
}

export async function sureKaydet({
  dosyaId,
  sonuc,
  not,
}: SureKaydetSecenekleri): Promise<string> {
  const zaman = simdi()
  const sureId = yeniId()
  const dosya = await db.dosyalar.get(dosyaId)

  // Süre + hareket tek transaction'da atomik yazılır: yarıda kalırsa ne kayıtsız
  // hareket ne de hareketsiz kayıt kalsın.
  await db.transaction(
    'rw',
    [db.sureler, db.hareketler],
    async () => {
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

      await db.hareketler.add({
        id: yeniId(),
        tur: 'sure-hesaplandi',
        baslik: 'Süre hesaplandı',
        ayrinti: dosya ? `${sonuc.kural.ad} · ${dosya.baslik}` : sonuc.kural.ad,
        dosyaId,
        zaman,
      })
    },
  )

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
