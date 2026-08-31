/**
 * Kaba token tahmini — birden çok modülde (araştırma ilişkilendirme M7.6,
 * yazma katmanı M8) aynı bütçe kontrolü tekrarlandığı için tek yerde tutulur.
 *
 * Türkçe hukuki metinde ~4 karakter ≈ 1 token (yaygın alt-kelime
 * tokenizer'ları için tipik oran; kesin değer modele göre değişir). Sınırlar
 * bu yüzden `CAPABILITIES.md` §0'daki gibi gevşek tutulur — amaç bağlam
 * penceresini kesin ölçmek değil, "tek pencereye sığar mı" sorusuna erken ve
 * ucuz bir cevap vermektir.
 */
export const CHARS_PER_TOKEN_ESTIMATE = 4

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE)
}
