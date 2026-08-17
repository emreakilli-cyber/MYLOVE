import { useState } from 'react'

/**
 * Form doğrulama hatasını ve hangi alanın hatalı olduğunu tek yerde tutar.
 *
 * `basarisiz(alan, mesaj)` hem hata metnini kurar, hem ilgili alanı işaretler,
 * hem de odağı o alana taşır — böylece kullanıcı (fare ve klavye) doğrudan
 * düzeltmesi gereken alana gider (WCAG 3.3.1 Hata Belirleme). Alanlara
 * `id={'alan-' + ad}` verilir; `alanHatasi(ad)` de `aria-invalid`'i yalnız
 * hatalı alana bağlar, böylece kırmızı kenarlık ancak o alanda çıkar.
 *
 * `setHata` alana bağlı olmayan genel hatalar için (ör. sunucu/yükleme hatası)
 * doğrudan kullanılabilir.
 */
export function useFormHata() {
  const [hata, setHata] = useState<string | null>(null)
  const [hataAlani, setHataAlani] = useState<string | null>(null)

  const basarisiz = (alan: string, mesaj: string): false => {
    setHata(mesaj)
    setHataAlani(alan)
    // Alan zaten DOM'da (form mount edilmiş); tıklama işleyicisi içinde eşzamanlı
    // odaklamak güvenli. aria-invalid bir sonraki render'da eklenir; odak ondan
    // bağımsızdır.
    document.getElementById('alan-' + alan)?.focus()
    return false
  }

  const temizle = () => {
    setHata(null)
    setHataAlani(null)
  }

  /** Hatalı alana yayılacak aria-invalid; diğer alanlara hiçbir şey eklemez. */
  const alanHatasi = (alan: string): { 'aria-invalid'?: true } =>
    hataAlani === alan ? { 'aria-invalid': true } : {}

  return { hata, hataAlani, basarisiz, temizle, alanHatasi, setHata }
}
