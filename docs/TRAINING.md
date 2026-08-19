# TRAINING — LoRA/QLoRA eğitim rehberi

> **Kapsam notu.** Bu belgenin tam içeriği plan M9'un işidir ve M9,
> `PLAN-HUKUKAI.md`'nin B listesinde ("en sona kalır") — henüz yazılmadı.
> Bu belge şimdilik yalnız M8.6'nın gerektirdiği tek bölümü taşır: fine-tuning
> ile **başlanmama** kararının gerekçesi. Veri formatı, hiperparametreler,
> donanım tablosu, adım adım yönerge ve değerlendirme (M9.1–M9.8) sonraki bir
> oturumda buraya eklenecek.

## Fine-tuning ile başlanmıyor (M8.6)

`docs/MODEL.md` §4'te aynı karar model seçimi açısından yazılı; burada aynı
karar **üslup öğrenme sırası** açısından tekrar edilir, çünkü M8'in bütün
tasarımı bu karara dayanır.

`CAPABILITIES.md` A8, üslup öğrenmeyi üç aşamalı tanımlar:

**(a) yapı/iskelet çıkarma (M8.2) → (b) üslup profili JSON (M8.3/M8.4) →
(c) few-shot seçimi (M8.5).**

Fine-tuning (LoRA/QLoRA) bu sıranın **dışında tutulur, dördüncü/opsiyonel bir
adım olarak en sona bırakılır**. Gerekçe:

1. **Veri yok.** LoRA için anlamlı bir alt sınır birkaç yüz örnek dilekçedir
   (bkz. gelecek M9.3). Yeni bir kullanıcının eski dilekçe arşivi bu sayıya
   ulaşana kadar (a)+(b)+(c) zaten daha iyi sonuç verir — sıfır örnekle de
   çalışır, LoRA çalışmaz.
2. **Geri alınamaz.** Few-shot'ta değişen şey bağlamdır — kötü sonuç verirse
   bir sonraki çağrıda bağlam değiştirilir, bedelsiz. Fine-tune'da değişen şey
   model ağırlıklarıdır — kötü çıkarsa yeniden eğitmek gerekir, ki bu da
   B2'nin (bölünemez bellek) verisi/zamanı gerektirir.
3. **Telefonda eğitilemez.** Eğitimin kendisi `CAPABILITIES.md` B2 —
   bölünemez yerleşik bellek gerekçesiyle masaüstüne düşer. Fine-tuning'e bel
   bağlamak, "telefon tek başına tam işlevsel" ilkesini (A/B ayrımının temeli)
   çiğnemek olurdu: masaüstü hiç kurulmasa üslup öğrenme de çalışmaz hâle
   gelirdi. (a)+(b)+(c) tamamen telefonda çalışır; fine-tuning yalnız isteğe
   bağlı bir kalite yükseltmesidir.
4. **Ölçemeden ayarlanmaz.** (a)+(b)+(c) üretimdeyken çıktı kalitesi
   ölçülebilir hâle gelir. Fine-tuning'in bir şey **kattığını** iddia etmek
   için önce bu temel çizgiye ihtiyaç var — yoksa "daha iyi" iddiası
   dayanaksız kalır (bkz. `MODEL.md`'deki aynı disiplin: "ölçülmeden karara
   dayanak yapılmaz").

**Sonuç:** `packages/hukuk-ai/src/write/` bugün yalnız (a)+(b)+(c)'yi
uygular (`structure.ts`, `styleProfile.ts`, `fewShot.ts`, `draft.ts`).
Fine-tuning kod tabanına HİÇ bağımlılık olarak girmez; ileride eklenirse
`DraftBackend` arayüzünün ARKASINDA, isteğe bağlı bir uygulama olarak girer —
mevcut sözleşme değişmez.
