# TRAINING — LoRA/QLoRA eğitimi (plan M9)

> **Durum:** Bu dosya henüz tamamlanmadı. Plan `PLAN-HUKUKAI.md`'de M9 B
> listesindedir ("en sona kalır") ve şu an sırası gelmedi. Burada yalnız
> **M8.6'nın gerektirdiği tek karar** var: fine-tuning ile başlanmama
> gerekçesi. M9 çalışmaya başladığında bu dosya veri formatı, hiperparametre
> tablosu, donanım gereksinimi, adım adım yönerge ve değerlendirme
> bölümleriyle genişletilecek (`PLAN-HUKUKAI.md` M9.1–M9.8).

## Fine-tuning ile başlanmıyor

Ayrıntılı gerekçe `docs/MODEL.md` §4'te yazılıdır — burada tekrarlanmaz, tek
cümleyle özetlenir ve oraya bağlanır:

**Üslup öğrenme sırası (a) yapı/iskelet çıkarma → (b) üslup profili → (c)
few-shot ile başlar (`CAPABILITIES.md` A8, `PLAN-HUKUKAI.md` M8); fine-tuning
bu üçü çalışıp ölçülmeden, ilk aşama olarak KULLANILMAZ.**

Dört gerekçe (veri yetersizliği, geri alınabilirlik, telefonda
eğitilememe — `CAPABILITIES.md` B2, ölçüm önceliği): bkz.
`docs/MODEL.md` §4.

## M9 başladığında buraya eklenecekler

- [ ] M9.1 Veri formatı: JSONL şeması, alan adları, örnek kayıt
- [ ] M9.2 Veri hazırlama: maskelenmiş korpustan eğitim seti üretme
- [ ] M9.3 Örnek sayısı: LoRA için alt sınır, önerilen aralık, doygunluk noktası
- [ ] M9.4 Hiperparametreler tablosu
- [ ] M9.5 Donanım gereksinimi (VRAM tablosu)
- [ ] M9.6 Tahminî süre ve maliyet
- [ ] M9.7 Adım adım çalıştırma yönergesi
- [ ] M9.8 Değerlendirme ve geri alma
