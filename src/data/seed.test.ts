import { describe, expect, it } from 'vitest'
import { tohumVerisi } from './seed'

/*
 * Referans videodaki gösterge paneli belirli sayılar gösteriyor. O sayılar
 * elle yazılmayacak, veriden hesaplanacak — dolayısıyla tohum verisinin
 * onları gerçekten üretmesi gerekiyor. Bu test o sözleşmeyi sabitler.
 */

const { dosyalar, olaylar, gorevler, finans, sureler } = tohumVerisi

function bugunBaslangic(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

describe('tohum verisi referans panelini karşılıyor', () => {
  it('24 aktif dosya', () => {
    const aktif = dosyalar.filter(
      (d) => d.durum !== 'kapali' && !d.arsivlendi,
    )
    expect(aktif).toHaveLength(24)
  })

  it('kapalı dosyalar aktif sayımın dışında', () => {
    expect(dosyalar.filter((d) => d.durum === 'kapali')).toHaveLength(3)
  })

  it('önümüzdeki 7 günde 8 duruşma, 2 tanesi bugün', () => {
    const bugun = bugunBaslangic().getTime()
    const haftaSonu = bugun + 7 * 86_400_000

    const durusmalar = olaylar.filter((o) => o.tur === 'durusma')
    const buHafta = durusmalar.filter((o) => {
      const t = new Date(o.baslangic).getTime()
      return t >= bugun && t < haftaSonu
    })
    expect(buHafta).toHaveLength(8)

    const bugunkuler = durusmalar.filter((o) => {
      const t = new Date(o.baslangic).getTime()
      return t >= bugun && t < bugun + 86_400_000
    })
    expect(bugunkuler).toHaveLength(2)
  })

  it('17 bekleyen görev, 4 tanesi yüksek öncelikli', () => {
    const bekleyen = gorevler.filter((g) => g.durum === 'bekliyor')
    expect(bekleyen).toHaveLength(17)
    expect(bekleyen.filter((g) => g.oncelik === 'yuksek')).toHaveLength(4)
  })

  it('bu ay 184.500,00 ₺ tahsilat', () => {
    const bugun = bugunBaslangic()
    const onEk = `${bugun.getFullYear()}-${String(bugun.getMonth() + 1).padStart(2, '0')}`

    const tahsilat = finans
      .filter((f) => f.yon === 'gelir' && f.tarih.startsWith(onEk))
      .reduce((toplam, f) => toplam + f.tutar, 0)

    expect(tahsilat).toBe(18_450_000) // kuruş
  })

  it('geçen aya göre tahsilat artışı %12', () => {
    const bugun = bugunBaslangic()
    const gecen = new Date(bugun.getFullYear(), bugun.getMonth() - 1, 1)
    const onEk = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    const topla = (ek: string) =>
      finans
        .filter((f) => f.yon === 'gelir' && f.tarih.startsWith(ek))
        .reduce((t, f) => t + f.tutar, 0)

    const buAy = topla(onEk(bugun))
    const gecenAy = topla(onEk(gecen))

    const artis = Math.round(((buAy - gecenAy) / gecenAy) * 100)
    expect(artis).toBe(12)
  })

  it('referanstaki üç süre doğru gün sayısıyla duruyor', () => {
    const beklenen = [
      ['İstinaf başvuru süresi', 2],
      ['Bilirkişi ücreti yatırılacak', 5],
      ['Cevap dilekçesi son günü', 9],
    ] as const

    const bugun = bugunBaslangic().getTime()
    for (const [ad, kalanGun] of beklenen) {
      const sure = sureler.find((s) => s.kuralAdi === ad)
      expect(sure, `${ad} bulunamadı`).toBeDefined()
      const fark = Math.round(
        (new Date(`${sure!.sonTarih}T00:00:00`).getTime() - bugun) / 86_400_000,
      )
      expect(fark, ad).toBe(kalanGun)
    }
  })

  it('her dosyanın müvekkili gerçekten var', () => {
    const muvekkilIdleri = new Set(tohumVerisi.muvekkiller.map((m) => m.id))
    for (const dosya of dosyalar) {
      expect(muvekkilIdleri.has(dosya.muvekkilId), dosya.baslik).toBe(true)
    }
  })

  it('her olay ve görev var olan bir dosyaya bağlı', () => {
    const dosyaIdleri = new Set(dosyalar.map((d) => d.id))
    for (const olay of olaylar) {
      expect(dosyaIdleri.has(olay.dosyaId!), olay.baslik).toBe(true)
    }
    for (const gorev of gorevler) {
      expect(dosyaIdleri.has(gorev.dosyaId!), gorev.baslik).toBe(true)
    }
  })
})

describe('tohum verisi — bütünsel çapraz referans bütünlüğü', () => {
  /*
   * Kimlikler string; tip sistemi çapraz referansları (finans→dosya vb.)
   * zorlamıyor. Sarkan tek bir referans demo'da yetim kayıt üretir (ör. hiçbir
   * dosyaya bağlanmayan finans satırı, eksik müvekkilli belge). Yukarıdaki blok
   * yalnız dosya→müvekkil, olay/görev→dosya'yı kapsıyordu; bu blok KALAN tüm
   * referansları da kapsayıp sarkan referansı derleme sırasında yakalar.
   */
  const {
    muvekkiller,
    dosyalar,
    olaylar,
    sureler,
    gorevler,
    finans,
    belgeler,
    hareketler,
    kullanicilar,
  } = tohumVerisi
  const dosyaId = new Set(dosyalar.map((d) => d.id))
  const muvekkilId = new Set(muvekkiller.map((m) => m.id))
  const kullaniciId = new Set(kullanicilar.map((k) => k.id))
  const finansId = new Set(finans.map((f) => f.id))
  const sureId = new Set(sureler.map((s) => s.id))

  /** İsteğe bağlı referans: yoksa geçerli, varsa kümede bulunmalı. */
  const gecerli = (kume: Set<string>, deger: string | undefined) =>
    deger === undefined || kume.has(deger)

  it('her süre var olan bir dosyaya bağlı', () => {
    for (const s of sureler) {
      expect(dosyaId.has(s.dosyaId), s.kuralAdi).toBe(true)
    }
  })

  it('her finans kaydı var olan dosya ve (varsa) müvekkile bağlı', () => {
    for (const f of finans) {
      expect(dosyaId.has(f.dosyaId), f.baslik).toBe(true)
      expect(gecerli(muvekkilId, f.muvekkilId), f.baslik).toBe(true)
    }
  })

  it('her belge (varsa) var olan dosya/müvekkil/finans kaydına bağlı', () => {
    for (const b of belgeler) {
      expect(gecerli(dosyaId, b.dosyaId), b.ad).toBe(true)
      expect(gecerli(muvekkilId, b.muvekkilId), b.ad).toBe(true)
      expect(gecerli(finansId, b.finansKaydiId), b.ad).toBe(true)
    }
  })

  it('görevlerin (varsa) müvekkil ve atanan kullanıcısı var olan kayıt', () => {
    for (const g of gorevler) {
      expect(gecerli(muvekkilId, g.muvekkilId), g.baslik).toBe(true)
      expect(gecerli(kullaniciId, g.atananKullaniciId), g.baslik).toBe(true)
    }
  })

  it('olayların (varsa) müvekkil ve süre referansı var olan kayıt', () => {
    for (const o of olaylar) {
      expect(gecerli(muvekkilId, o.muvekkilId), o.baslik).toBe(true)
      expect(gecerli(sureId, o.sureId), o.baslik).toBe(true)
    }
  })

  it('her hareket (varsa) var olan dosya/müvekkile bağlı', () => {
    for (const h of hareketler) {
      expect(gecerli(dosyaId, h.dosyaId), h.id).toBe(true)
      expect(gecerli(muvekkilId, h.muvekkilId), h.id).toBe(true)
    }
  })
})
