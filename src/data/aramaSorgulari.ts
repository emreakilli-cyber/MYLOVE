import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { Belge, Dosya, Gorev, Muvekkil } from '../domain/types'

/*
 * Genel arama: dosya, müvekkil, görev ve belgelerde tek kutudan.
 *
 * Veri zaten cihazda ve küçük (bir büronun dosyaları) olduğu için arama
 * bellekte, tabloları tarayarak yapılıyor — ayrı bir dizin tutmaya gerek yok.
 * Küçük/büyük harf Türkçe kurallarıyla katlanıyor ("İ/ı"): `toLocaleLowerCase('tr')`.
 */

const MIN_UZUNLUK = 2

/**
 * Türkçe küçük harfe indirger; boşları güvenli geçer. `toLocaleLowerCase('tr')`
 * ZORUNLU: düz `toLowerCase()` "İ"yi birleşik noktalı "i̇"ye, "I"yı "i"ye çevirip
 * "İstanbul"/"ışık" aramalarını sessizce eşleşmez yapardı.
 */
export function nrm(metin: string | undefined): string {
  return (metin ?? '').toLocaleLowerCase('tr')
}

/** `sorgu` (önceden `nrm`'lenmiş) alanların herhangi birinde geçiyor mu. */
export function eslesir(sorgu: string, ...alanlar: (string | undefined)[]): boolean {
  return alanlar.some((a) => nrm(a).includes(sorgu))
}

export interface BelgeSonucu {
  belge: Belge
  dosyaBaslik?: string
}

export interface AramaSonuclari {
  dosyalar: Dosya[]
  muvekkiller: Muvekkil[]
  gorevler: Gorev[]
  belgeler: BelgeSonucu[]
  toplam: number
}

const BOS: AramaSonuclari = {
  dosyalar: [],
  muvekkiller: [],
  gorevler: [],
  belgeler: [],
  toplam: 0,
}

/**
 * Tüm çalışma alanında arama. `undefined` = yükleniyor, boş sonuç = eşleşme yok.
 * Sorgu iki karakterden kısaysa arama yapılmaz (gürültüyü önler).
 */
export function useGlobalArama(
  ham: string,
): AramaSonuclari | undefined {
  const sorgu = nrm(ham.trim())
  return useLiveQuery(async () => {
    if (sorgu.length < MIN_UZUNLUK) return BOS

    const [dosyalar, muvekkiller, gorevler, belgeler] = await Promise.all([
      db.dosyalar.toArray(),
      db.muvekkiller.toArray(),
      db.gorevler.toArray(),
      db.belgeler.toArray(),
    ])

    const dosyaEslesme = dosyalar.filter(
      (d) =>
        !d.arsivlendi &&
        eslesir(sorgu, d.baslik, d.esasNo, d.mahkeme, d.karsiTaraf, d.konu, d.kararNo),
    )
    const muvekkilEslesme = muvekkiller.filter(
      (m) =>
        !m.arsivlendi &&
        (eslesir(sorgu, m.ad, m.kimlikNo, m.telefon, m.eposta) ||
          m.etiketler.some((e) => nrm(e).includes(sorgu))),
    )
    const gorevEslesme = gorevler.filter((g) =>
      eslesir(sorgu, g.baslik, g.aciklama),
    )

    // Belge adı, türü ya da etiketiyle eşleşenler; üst dosya başlığını iliştir.
    const dosyaAdlari = new Map(dosyalar.map((d) => [d.id, d.baslik]))
    const belgeEslesme: BelgeSonucu[] = belgeler
      .filter(
        (b) =>
          eslesir(sorgu, b.ad, b.not) ||
          b.etiketler.some((e) => nrm(e).includes(sorgu)),
      )
      .map((belge) => ({
        belge,
        ...(belge.dosyaId
          ? { dosyaBaslik: dosyaAdlari.get(belge.dosyaId) }
          : {}),
      }))

    return {
      dosyalar: dosyaEslesme,
      muvekkiller: muvekkilEslesme,
      gorevler: gorevEslesme,
      belgeler: belgeEslesme,
      toplam:
        dosyaEslesme.length +
        muvekkilEslesme.length +
        gorevEslesme.length +
        belgeEslesme.length,
    }
  }, [sorgu])
}
