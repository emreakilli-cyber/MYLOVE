/**
 * Metin istatistiği yardımcıları — `write/styleProfile.ts` ve `write/fewShot.ts`
 * ortak kullanır. Model gerektirmez, tamamen deterministik.
 */

/** Boş satırla ayrılmış paragraflar. */
export function splitParagraphs(text: string): readonly string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
}

/** Nokta/ünlem/soru işaretinden sonraki boşlukta böler — kaba ama yeterli. */
export function splitSentences(paragraph: string): readonly string[] {
  return paragraph
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
}

export function wordCount(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return words.length
}

/** Basit kelime kümesi — benzerlik ölçümü için (Jaccard). */
export function wordSet(text: string): ReadonlySet<string> {
  return new Set(
    text
      .toLocaleLowerCase('tr')
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length > 2),
  )
}
