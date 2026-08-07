/**
 * Modelsiz varsayılan NER uygulaması — plan M3.3.
 *
 * Bu katman model olmadan da çalışmak zorunda: `docs/MODEL.md` §3.1'e göre
 * telefonda NER'i bir encoder token sınıflandırıcı yapacak, ama model
 * indirilmemişse ya da yüklenemiyorsa maskeleme durmaz. Kısıtsızlık kuralı
 * (`CAPABILITIES.md` A3) bunu gerektiriyor.
 *
 * İki kaynağa dayanır:
 *   1. Cihazdaki kayıtlardan gelen bilinen adlar (müvekkil, karşı taraf, vekil)
 *   2. Türkçe hukuki metnin yapısal ipuçları (`Av.`, `Ltd. Şti.`, `Mah.`, `AVM`)
 *
 * Bilinen sınır: ipucu taşımayan çıplak bir özel ad yakalanmaz. SPEC §7/2 bunu
 * açıkça yazıyor; kapatma yolu model katmanıdır.
 */

import { nameKey, splitAtApostrophe } from '../../turkish/suffix'
import type { FreeRegion, NerBackend, NerCandidate, NerEntityType } from './types'

export interface DictionaryNerOptions {
  /** Cihazdaki kayıtlardan gelen kişi adları. */
  readonly people?: readonly string[]
  readonly organizations?: readonly string[]
  readonly workplaces?: readonly string[]
}

/** Ünsüz yumuşaması olmuş yazımı da arayabilmek için (M4.3). */
const SOFTENING: Readonly<Record<string, string>> = { t: 'd', p: 'b', ç: 'c', k: 'ğ' }

const TITLE_CUE = /(?:Av\.|Dr\.|Prof\.|Doç\.|Sn\.|Sayın)\s+((?:\p{Lu}[\p{L}]*['’ʼ]?[\p{L}]*)(?:\s+\p{Lu}[\p{L}]*['’ʼ]?[\p{L}]*){0,2})/gu

const ORG_CUE = /(?:\p{Lu}[\p{L}]*\s+){1,4}(?:A\.\s?Ş\.?|Ltd\.\s?Şti\.?|Ltd\.|Şti\.)/gu

const WORKPLACE_CUE = /(?:\p{Lu}[\p{L}]*\s+){1,3}(?:AVM|Plaza|İş\s+Merkezi|Alışveriş\s+Merkezi|Hastanesi|Oteli)/gu

const ADDRESS_MARKER = '(?:Mah\\.|Mahallesi|Cad\\.|Caddesi|Sok\\.|Sokak|Sk\\.|Bulv\\.|Bulvarı)'
const ADDRESS_TAIL =
  `(?:\\s+(?:${ADDRESS_MARKER}|No\\s*[:.]?\\s*\\d+[\\p{L}]?|Kat\\s*[:.]?\\s*\\d+|Daire\\s*[:.]?\\s*\\d+|Blok|Apt\\.|Apartmanı|Sitesi|\\d+[\\p{L}]?))*`
/**
 * Başta yalnız TEK büyük harfli sözcüğe izin veriliyor. İki sözcüğe izin
 * verildiğinde cümle başındaki sıradan sözcük ("Tebligat Alsancak Mah.")
 * adrese dâhil oluyordu. Bedeli: iki sözcüklü mahalle adının ilk sözcüğü
 * dışarıda kalabilir — kaçırmak, fazladan yutmaktan daha az zararlı.
 */
const ADDRESS_CUE = new RegExp(
  `(?:\\p{Lu}[\\p{L}]*\\s+){0,1}${ADDRESS_MARKER}${ADDRESS_TAIL}`,
  'gu',
)

function isLetter(char: string | undefined): boolean {
  return char !== undefined && /\p{L}/u.test(char)
}

function isWordEdge(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text[start - 1] : undefined
  const after = end < text.length ? text[end] : undefined
  if (isLetter(before) || (before !== undefined && /\d/.test(before))) return false
  // Ekin kendisi (kesme işareti) sınırı bozmaz — ek metinde kalır (M4.7).
  if (isLetter(after)) return false
  return true
}

/**
 * Aralığın sonundaki kesme işaretli eki dışarıda bırakır: `Yılmaz'ın` →
 * maskelenecek kısım `Yılmaz`, `'ın` metinde kalır (M4.7).
 */
function trimSuffix(text: string, start: number, end: number): number {
  const slice = text.slice(start, end)
  const split = splitAtApostrophe(slice)
  return split ? start + split.root.length : end
}

function soften(word: string): string | undefined {
  const last = word[word.length - 1]
  if (last === undefined) return undefined

  const softened = SOFTENING[last.toLocaleLowerCase('tr')]
  if (softened === undefined) return undefined

  const isUpper = last === last.toLocaleUpperCase('tr')
  return word.slice(0, -1) + (isUpper ? softened.toLocaleUpperCase('tr') : softened)
}

/**
 * `Ahmet Yılmaz` için `Ahmed Yılmaz` gibi yumuşamış yazımları da üretir.
 * Yumuşama SÖZCÜK bazlıdır — ad birden çok sözcükten oluşuyorsa her sözcük
 * ayrı ayrı denenir. Kombinasyon patlaması olmasın diye her seferinde tek
 * sözcük yumuşatılır (n sözcük → n+1 varyant).
 */
function surfaceVariants(name: string): string[] {
  const words = name.split(' ')
  const variants = [name]

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]
    if (word === undefined) continue

    const softened = soften(word)
    if (softened === undefined) continue

    const copy = [...words]
    copy[index] = softened
    variants.push(copy.join(' '))
  }

  return variants
}

function findKnownNames(
  text: string,
  regions: readonly FreeRegion[],
  names: readonly string[],
  type: NerEntityType,
): NerCandidate[] {
  const found: NerCandidate[] = []
  const upperText = text.toLocaleUpperCase('tr')

  for (const name of names) {
    const trimmedName = name.trim()
    if (trimmedName.length < 2) continue

    for (const variant of surfaceVariants(trimmedName)) {
      const needle = variant.toLocaleUpperCase('tr')
      let from = 0
      for (;;) {
        const index = upperText.indexOf(needle, from)
        if (index < 0) break
        from = index + 1

        const end = index + variant.length
        if (!isWordEdge(text, index, end)) continue
        if (!regions.some((region) => index >= region.start && end <= region.end)) continue

        found.push({
          start: index,
          end,
          type,
          confidence: 1,
          key: nameKey(trimmedName),
        })
      }
    }
  }
  return found
}

function findByCue(
  text: string,
  regions: readonly FreeRegion[],
  pattern: RegExp,
  type: NerEntityType,
  /** Eşleşmenin hangi grubu maskelenecek — 0 tamamı. */
  group: number,
  confidence: number,
): NerCandidate[] {
  const found: NerCandidate[] = []
  pattern.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const captured = group === 0 ? match[0] : match[group]
    if (captured === undefined) continue

    const offset = group === 0 ? 0 : match[0].indexOf(captured)
    if (offset < 0) continue

    const start = match.index + offset
    const rawEnd = start + captured.replace(/\s+$/, '').length
    const end = trimSuffix(text, start, rawEnd)
    if (end <= start) continue
    if (!regions.some((region) => start >= region.start && end <= region.end)) continue

    found.push({
      start,
      end,
      type,
      confidence,
      key: nameKey(text.slice(start, end)),
    })
  }
  return found
}

export function createDictionaryNerBackend(
  options: DictionaryNerOptions = {},
): NerBackend {
  const people = options.people ?? []
  const organizations = options.organizations ?? []
  const workplaces = options.workplaces ?? []

  return {
    id: 'dictionary',
    runsLocally: true,
    detect(text, regions) {
      return [
        ...findKnownNames(text, regions, people, 'KISI'),
        ...findKnownNames(text, regions, organizations, 'KURUM'),
        ...findKnownNames(text, regions, workplaces, 'ISYERI'),
        ...findByCue(text, regions, TITLE_CUE, 'KISI', 1, 0.85),
        ...findByCue(text, regions, ORG_CUE, 'KURUM', 0, 0.8),
        ...findByCue(text, regions, WORKPLACE_CUE, 'ISYERI', 0, 0.8),
        ...findByCue(text, regions, ADDRESS_CUE, 'ADRES', 0, 0.75),
      ]
    },
  }
}
