# TRAINING — LoRA/QLoRA eğitimi

Plan M9 (`CAPABILITIES.md` B2 — bölünemez yerleşik bellek, B listesi).

> Bu belge henüz **iskelet** hâlindedir. Yalnız M8.6'nın gerektirdiği "fine-tuning
> ile başlanmıyor" kararı ve gerekçesi burada tamdır. Veri formatı, hiperparametre
> tablosu, donanım/maliyet tahmini, adım adım çalıştırma yönergesi ve
> değerlendirme yöntemi (M9.1–M9.8) ayrı bir oturumda yazılacak.

---

## 0. Karar (M8.6): fine-tuning ile başlanmıyor

Üslup öğrenme sırası `CAPABILITIES.md` A8 ve plan M8'de tanımlı:
**(a) yapı/iskelet çıkarma → (b) üslup profili JSON → (c) few-shot seçimi.**
Fine-tuning bu sıranın **sonuna** bırakıldı, ilk adım değil.

Gerekçe (`MODEL.md` §4 ile aynı, burada da tekrarlanır çünkü M8.6 kararın iki
belgede de gerekçeli yazılmasını istiyor):

1. **Veri yok.** LoRA için anlamlı bir alt sınır birkaç yüz örnektir (bkz. M9.3,
   sayı belirlenecek). Kullanıcının eski dilekçe arşivi bu sayıya ulaşana kadar
   few-shot (M8.5) zaten daha iyi/eşit sonuç verir ve sıfır örnekte bile çalışır.
2. **Geri alınamaz.** Few-shot'ta bağlamı değiştirirsiniz, biter; kötü sonuç
   verdiyse bir sonraki istekte düzeltilir. Fine-tune'da model ağırlıkları
   kalıcı değişir; kötü çıkan bir eğitim yeniden eğitim gerektirir.
3. **Telefonda eğitilemez.** Eğitim `CAPABILITIES.md` B2 — taban model +
   gradyan + optimizasyon durumu aynı anda bellekte, bölünemez. Fine-tuning'e
   bel bağlamak telefon-öncelikli kuralı (bkz. `CAPABILITIES.md` başlık) çiğner;
   eğitim her zaman masaüstü/kiralık GPU gerektirir, isteğe bağlı kalmalı.
4. **Ölçemeden ayarlanmaz.** Üslup profili + few-shot çalışırken çıktı kalitesi
   önce ölçülür (kullanıcı geri bildirimi, M8.7 tutarlılık geçişi bulguları);
   ancak o ölçüm temeli varsa fine-tuning'in gerçekten bir şey kattığı
   iddia edilebilir. Ölçüm yokken eğitime başlamak kör yatırımdır.

**Sonuç:** LoRA/QLoRA, telefon tarafında **hiçbir özelliğin önkoşulu değildir**.
Masaüstünde isteğe bağlı bir kalite yükseltmesi olarak M9'da ayrıntılandırılacak.

---

## 1–8. (M9 — yazılacak)

- [ ] M9.1 Veri formatı: JSONL şeması, alan adları, örnek kayıt
- [ ] M9.2 Veri hazırlama: maskelenmiş korpustan eğitim seti üretme; ham
      müvekkil verisi eğitime girmez
- [ ] M9.3 Örnek sayısı: LoRA için alt sınır, önerilen aralık, doygunluk noktası
- [ ] M9.4 Hiperparametreler: rank, alpha, dropout, öğrenme oranı, epoch, batch,
      gradyan biriktirme
- [ ] M9.5 Donanım gereksinimi: VRAM tablosu (7B/9B/27B × LoRA/QLoRA)
- [ ] M9.6 Tahminî süre ve maliyet: yerel GPU ve kiralık GPU için ayrı
- [ ] M9.7 Adım adım çalıştırma yönergesi
- [ ] M9.8 Değerlendirme: eğitim sonrası kalite nasıl ölçülür, geri alma nasıl yapılır

Bu maddeler `docs/PLAN-HUKUKAI.md` M9'da ayrıca izlenir.
