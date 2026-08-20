/*
 * Metin yardımcıları.
 */

/**
 * İki metni TÜRKÇE alfabe sırasına göre karşılaştırır (`localeCompare('tr')`).
 * Zorunlu: düz karşılaştırma Türkçe harfleri yanlış sıralar — Türk alfabesinde
 * "ı", "i"den ÖNCE (I/İ ayrı harfler), "ç"/"ş"/"ğ" ise "c"/"s"/"g"den SONRA
 * gelir. Müvekkil ve dosya listelerinin doğru alfabetik sırası buna dayanır;
 * argümanı unutmamak için tek noktada topluyoruz.
 */
export function turkceKarsilastir(a: string, b: string): number {
  return a.localeCompare(b, 'tr')
}
