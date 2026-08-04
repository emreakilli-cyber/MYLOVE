import Dexie, { type EntityTable } from 'dexie'
import type {
  Ayarlar,
  Belge,
  Dosya,
  FinansKaydi,
  Gorev,
  Hareket,
  Hatirlatma,
  Kisi,
  Kullanici,
  Muvekkil,
  Not,
  Olay,
  Sure,
} from '../domain/types'

/*
 * Local-first depolama. Müvekkil verisi ve belgeler cihazın IndexedDB'sinde
 * kalır; hiçbir tablo ağa açılmaz.
 *
 * Şema değişikliğinde: yeni bir `.version(n).stores({...})` bloğu eklenir,
 * eskisi SİLİNMEZ. Dexie kurulu cihazları sırayla yükseltir; blokları silmek
 * mevcut kullanıcının verisini bozar.
 *
 * İndeks seçimi genel bakış ekranının sorgularına göre yapıldı: tarih
 * aralığıyla olay çekmek, en yakın süreleri sıralamak, açık görevleri vadeye
 * göre almak ve son hareketleri zamana göre listelemek indeks ister.
 */

export class JurisDb extends Dexie {
  muvekkiller!: EntityTable<Muvekkil, 'id'>
  dosyalar!: EntityTable<Dosya, 'id'>
  olaylar!: EntityTable<Olay, 'id'>
  sureler!: EntityTable<Sure, 'id'>
  gorevler!: EntityTable<Gorev, 'id'>
  finans!: EntityTable<FinansKaydi, 'id'>
  belgeler!: EntityTable<Belge, 'id'>
  kisiler!: EntityTable<Kisi, 'id'>
  notlar!: EntityTable<Not, 'id'>
  hatirlatmalar!: EntityTable<Hatirlatma, 'id'>
  hareketler!: EntityTable<Hareket, 'id'>
  kullanicilar!: EntityTable<Kullanici, 'id'>
  ayarlar!: EntityTable<Ayarlar, 'id'>

  constructor() {
    super('juriscalendar')

    this.version(1).stores({
      muvekkiller: 'id, ad, tur, arsivlendi',
      dosyalar: 'id, baslik, muvekkilId, tur, durum, arsivlendi, acilisTarihi',
      olaylar:
        'id, baslangic, tur, durum, dosyaId, muvekkilId, sureId, [durum+baslangic]',
      sureler: 'id, sonTarih, durum, dosyaId, [durum+sonTarih]',
      gorevler:
        'id, vadeTarihi, durum, oncelik, dosyaId, muvekkilId, atananKullaniciId, [durum+vadeTarihi]',
      finans:
        'id, tarih, dosyaId, muvekkilId, yon, kategori, odemeDurumu, vadeTarihi, [odemeDurumu+vadeTarihi]',
      belgeler: 'id, ad, tur, dosyaId, muvekkilId, finansKaydiId',
      kisiler: 'id, dosyaId, rol',
      notlar: 'id, dosyaId, muvekkilId, tur, olusturmaTarihi',
      hatirlatmalar:
        'id, planlananZaman, durum, hedefId, [hedefTuru+hedefId], [durum+planlananZaman]',
      hareketler: 'id, zaman, tur, dosyaId, muvekkilId',
      kullanicilar: 'id, ad, aktif',
      ayarlar: 'id',
    })
  }
}

export const db = new JurisDb()

/** Yeni kayıt kimliği. */
export function yeniId(): string {
  return crypto.randomUUID()
}

/** Şu anın ISO damgası — kayıt zamanlarında tek kaynak. */
export function simdi(): string {
  return new Date().toISOString()
}
