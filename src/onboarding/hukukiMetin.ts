/*
 * Hukuki onay metinleri.
 *
 * ÖNEMLİ: Metinlerin İÇERİĞİ yer tutucudur; nihai Kullanım Şartları / Aydınlatma
 * Metni AVUKAT tarafından hazırlanacaktır (bkz. docs/PLAN.md → BEKLEYEN). Sürüm
 * değişince (HUKUKI_METIN_SURUMU) uygulama yeniden onay ister. Onay kaydı; tarih,
 * saat, sürüm ve metin hash'iyle cihaza yazılır.
 */

/** Metin her değiştiğinde artırın — değişince yeniden onay istenir. */
export const HUKUKI_METIN_SURUMU = '2026-08-05-taslak-1'

/** Kaydırılıp sonuna gelinmesi gereken uzun metin (yer tutucu). */
export const aydinlatmaMetni = `[YER TUTUCU — nihai metin avukat tarafından hazırlanacaktır]

KULLANIM ŞARTLARI VE AYDINLATMA METNİ (TASLAK)

1. Uygulama, hukuk profesyonellerinin dosya, süre ve müvekkil bilgilerini
   yönetmesine yardımcı olan yerel-öncelikli (local-first) bir araçtır. Verileriniz
   öncelikle bu cihazda saklanır.

2. Hukuki süre hesaplamaları bilgilendirme amaçlıdır; bağlayıcı hukuki tavsiye
   değildir. Sürelerin doğruluğunun teyidi kullanıcının sorumluluğundadır.

3. Yapay zekâ (AI) katmanı varsayılan olarak kapalıdır ve yalnızca kullanıcı kendi
   anahtarıyla açtığında çalışır. Açıldığında cihazdan çıkan metin maskelenmiş
   olsa dahi, çıktının denetimi ve meslek sırrına uygun kullanımı kullanıcıya
   aittir.

4. Maskeleme, kimlik bilgilerinin AI sağlayıcısına gitmemesini hedefler; ancak
   tam anonimleştirme garantisi değildir. Gönderim öncesi onay ekranını kontrol
   etmek kullanıcının sorumluluğundadır.

5. Uygulama kilidi (PIN/biyometri) bir erişim kapısıdır. Şifrenin unutulması
   hâlinde şifreli yedekler ve korunan veriler kurtarılamayabilir.

6. Cihaz güvenliği (işletim sistemi güncellemeleri, cihaz şifrelemesi, fiziksel
   erişim) kullanıcının sorumluluğundadır.

7. KVKK kapsamında; müvekkil verisi hassas veri niteliğinde olabilir. Uygulama
   üçüncü taraf analitiği içermez ve veriyi pazarlama amacıyla kullanmaz.

[Bu bölüm avukat tarafından tamamlanacaktır. Onaylamadan önce metnin tamamını
okuyunuz; aşağıdaki kutuları işaretlemek için metni sonuna kadar kaydırın.]

— TASLAK SONU —`

/** Onaylanacak beş madde (sabit sırayla). */
export const onayMaddeleri: readonly string[] = [
  'Kullanım Şartları ve Aydınlatma Metni’ni okudum, kabul ediyorum.',
  'Şifremi unutursam verilerim kurtarılamaz.',
  'Maskeleme tam anonimleştirme değildir; onay ekranını kontrol etmek benim sorumluluğumdadır.',
  'AI çıktısı taslaktır; doğruluğunu kontrol etmek ve meslek sırrına uygun kullanmak benim sorumluluğumdadır.',
  'Cihazımın güvenliği benim sorumluluğumdadır.',
]

/** Hash'i alınan tam metin (metin + maddeler). */
export function hukukiTamMetin(): string {
  return `${HUKUKI_METIN_SURUMU}\n${aydinlatmaMetni}\n${onayMaddeleri.join('\n')}`
}
