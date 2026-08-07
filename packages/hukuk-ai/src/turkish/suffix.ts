/**
 * Türkçe çekim eki normalleştirmesi — plan M4, `docs/SPEC.md` §4.1 / S6.
 *
 * Amaç tek cümleyle: `Ahmet`, `Ahmet'in`, `Ahmet'e`, `Ahmet'ten`, `Ahmed'e`
 * hepsi AYNI maske token'ına düşsün — ama ek metinde kalsın, maskeye girmesin
 * (M4.7). Yani maskelenen aralık yalnız `Ahmet` / `Ahmed` kökü olur, `'in`
 * olduğu yerde durur ve `[KISI_1]'in` okunur.
 *
 * Bu bir morfolojik çözümleyici değil; özel adlar için dar ve denetimli bir
 * ek soyucudur. Genel Türkçe sözcüklere uygulanmaz.
 */

/** Kesme işaretinin daktilo ve tipografik biçimleri. */
const APOSTROPHES = ["'", '’', 'ʼ']

/**
 * Kesme işaretsiz yazımda denenecek ekler. Ünlü/ünsüz uyumunun bütün
 * varyantları elle sayılıyor — böylece uyum kurallarını ayrıca uygulamak
 * gerekmiyor (M4.4). Uzun ekler önce denenir.
 */
const SUFFIXES: readonly string[] = [
  // yönelme + tamlayan + çıkma + bulunma, kaynaştırma harfli biçimler
  'ndan', 'nden', 'ntan', 'nten',
  'dan', 'den', 'tan', 'ten',
  'nın', 'nin', 'nun', 'nün',
  'ın', 'in', 'un', 'ün',
  'yla', 'yle', 'la', 'le',
  'nda', 'nde', 'nta', 'nte',
  'da', 'de', 'ta', 'te',
  'ler', 'lar',
  'na', 'ne', 'ya', 'ye',
  'nı', 'ni', 'nu', 'nü',
  'ı', 'i', 'u', 'ü', 'a', 'e',
].sort((a, b) => b.length - a.length)

/**
 * Ünsüz yumuşaması (M4.3): `Ahmet` → `Ahmed'in`, `Kitap` → `Kitab'ı`.
 * Kök anahtarı üretirken yumuşamış ünsüz sertine çevrilir ki iki yazım aynı
 * anahtara düşsün.
 */
const HARDENING: Readonly<Record<string, string>> = {
  D: 'T',
  B: 'P',
  C: 'Ç',
  Ğ: 'K',
}

export interface SplitName {
  /** Ekten arındırılmış ham kök — metinde maskelenecek olan tam olarak budur. */
  readonly root: string
  /** Ayrılan ek (kesme işareti dâhil). Metinde olduğu gibi kalır. */
  readonly suffix: string
}

function upperTr(value: string): string {
  return value.toLocaleUpperCase('tr')
}

/**
 * Eşleme anahtarı: Türkçe kurala göre büyütür ve son ünsüzü sertleştirir.
 * `Ahmet` ve `Ahmed` → `AHMET`.
 */
export function nameKey(root: string): string {
  const upper = upperTr(root.trim())
  if (upper.length === 0) return upper

  const last = upper[upper.length - 1]
  const hardened = last === undefined ? undefined : HARDENING[last]
  if (hardened === undefined) return upper

  return upper.slice(0, -1) + hardened
}

/**
 * Kesme işaretli yazımı ayırır: `Ahmet'in` → kök `Ahmet`, ek `'in`.
 * Kesme işareti yoksa `undefined` döner.
 */
export function splitAtApostrophe(word: string): SplitName | undefined {
  for (const apostrophe of APOSTROPHES) {
    const index = word.lastIndexOf(apostrophe)
    // Kesme başta olamaz; sonda ise ek yok demektir.
    if (index <= 0 || index === word.length - 1) continue

    const root = word.slice(0, index)
    const suffix = word.slice(index)
    // Kesmeden sonrası ek gibi görünmeli (kısa ve harf).
    if (suffix.length > 6) continue
    if (!/^[\p{L}]+$/u.test(suffix.slice(1))) continue

    return { root, suffix }
  }
  return undefined
}

/**
 * Kesme işaretsiz yazımda ek soyar (M4.2) — ama YALNIZCA kalan kök bilinen
 * adlar kümesindeyse. Bu kısıt bilerek konuldu: `Mahkeme` sözcüğünden `-me`
 * soyup `Mahke` üretmek gibi bir yıkımı ancak bu engeller.
 */
export function stripKnownSuffix(
  word: string,
  isKnownRoot: (candidate: string) => boolean,
): SplitName | undefined {
  for (const suffix of SUFFIXES) {
    if (word.length <= suffix.length + 2) continue
    if (!upperTr(word).endsWith(upperTr(suffix))) continue

    const root = word.slice(0, word.length - suffix.length)
    if (isKnownRoot(nameKey(root))) {
      return { root, suffix: word.slice(word.length - suffix.length) }
    }
  }
  return undefined
}

/**
 * Bir sözcüğü kök + ek olarak ayırır. Önce kesme işareti (güvenilir), sonra
 * bilinen köke dayalı soyma (denetimli). Hiçbiri tutmazsa sözcük olduğu gibi
 * köktür.
 */
export function splitName(
  word: string,
  isKnownRoot: (candidate: string) => boolean = () => false,
): SplitName {
  const byApostrophe = splitAtApostrophe(word)
  if (byApostrophe) return byApostrophe

  const bySuffix = stripKnownSuffix(word, isKnownRoot)
  if (bySuffix) return bySuffix

  return { root: word, suffix: '' }
}
