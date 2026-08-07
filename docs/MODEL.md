# MODEL — Model seçimi ve gerekçesi

Plan M3.4 / M3.5.

> **Doğrulama notu.** Bu ortamda `huggingface.co` egress proxy tarafından
> kapalıdır; model kartları **doğrudan okunamadı**. Aşağıdaki tabloda her satır
> `doğrulandı` / `ikincil kaynak` / `tahmin` olarak işaretlidir. `tahmin`
> işaretli hiçbir değer karara dayanak yapılmadı. Lisans satırları uygulamaya
> alınmadan önce model kartından **birebir teyit edilmelidir** — App Store'a
> model gömmek lisans meselesidir.

---

## 1. Kararın çerçevesi

Maskeleme NER'i ile metin üretimi **aynı iş değildir** ve aynı modeli
istemezler. İkisini ayrı ayrı seçiyoruz:

| İş | Ne gerekiyor |
|---|---|
| **NER (maskeleme)** | Her token'a etiket. Kaçırma = kimlik sızıntısı. Uydurma yapmamalı. Kısa pencere yeterli |
| **Üretim (yazma/özet)** | Akıcı Türkçe hukuk metni, talimat takibi, uzunca bağlam |

---

## 2. Karşılaştırma

### 2.1 Aday modeller

| Model | Parametre | Temel | Lisans | Q4 boyut | Bağlam | Telefonda? |
|---|---|---|---|---|---|---|
| **Mizan-27B**<br>`AlicanKiraz0/Mizan-27B-Turkish-Legal-LLM` | 27 B | Qwen3.6-27B | *teyit gerek* | ~16 GB *(tahmin)* | *teyit gerek* | **Hayır** |
| **Turkish-Gemma-9b-v0.1**<br>`ytu-ce-cosmos` | 9 B | Gemma 2 | **Gemma Terms** *(ikincil kaynak)* | ~5,5 GB *(tahmin)* | 8 K *(tahmin)* | **Hayır** |
| **Turkish-Gemma-9b-T1** | 9 B | Gemma 2 | Gemma Terms | ~5,5 GB *(tahmin)* | — | Hayır |
| Gemma 3n E2B | ~5 B ham / ~2 B etkin | Gemma 3n | Gemma Terms | ~2–3 GB *(tahmin)* | 32 K *(tahmin)* | **Sınırda** |
| Qwen3.5-4B | 4 B | Qwen3.5 | *teyit gerek* | ~2,4 GB *(tahmin)* | 32 K *(tahmin)* | **Sınırda** |
| Qwen3.5-2B | 2 B | Qwen3.5 | *teyit gerek* | ~1,2 GB *(tahmin)* | 32 K *(tahmin)* | **Evet** |
| Llama 3.2 3B | 3 B | Llama 3.2 | Llama Community | ~1,9 GB *(tahmin)* | 128 K | Sınırda |
| **`savasy/bert-base-turkish-ner-cased`** | ~110 M | BERTurk | *teyit gerek* | ~0,11 GB (int8) | 512 token | **Evet, rahat** |
| `akdeniz27/bert-base-turkish-cased-ner` | ~110 M | BERTurk | *teyit gerek* | ~0,11 GB (int8) | 512 token | Evet |

### 2.2 Türkçe hukuki metin kalitesi

| Model | Ne biliyoruz | Kaynak gücü |
|---|---|---|
| Mizan-27B | 21.000+ Türk hukuku belgesi (Anayasa, mevzuat, içtihat, doktrin) üzerinde eğitilmiş; RAG mimarisi ile atıf veriyor. **Model kartı kendisi "var olmayan kanun/karar üretebilir, resmî kaynaktan teyit edin" diyor** | ikincil kaynak |
| Turkish-Gemma-9b | 1.450 soruluk, 18 insan değerlendiricili karşılaştırmalı test. Genel Türkçe üretim; **hukuka özel değil** | ikincil kaynak |
| BERTurk NER | PER / LOC / ORG üzerinde P 0,916 · R 0,934 · **F1 0,925** | ikincil kaynak |
| 2–4 B genel modeller | Türkçe hukuk için özel ölçüm **yok**. Gemma 3n 140+ dil iddiasında; hukuki Türkçe ayrı bir mesele | ölçülmedi |

---

## 3. Karar

### 3.1 Telefon — NER: **encoder token sınıflandırıcı, üretici model DEĞİL**

**Seçim:** BERTurk tabanlı NER (`savasy/bert-base-turkish-ner-cased` sınıfı),
int8 kuantize, ~110 MB.

Gerekçe — bu kararın üç ayağı var ve üçü de ölçülebilir:

1. **Bellek.** 110 MB, 1,2 GB bütçenin %9'u. Bir 2–4 B üretici model (1,2–2,4 GB)
   tek başına bütçeyi doldurur ve maskeleme için başka hiçbir şeye yer bırakmaz.
   Maskeleme her işin ön koşulu olduğu için (A3) sürekli yüklü kalmalı.
2. **Yapısal güvence — asıl gerekçe.** Token sınıflandırıcı **her token'a** bir
   etiket verir. Bir aralığı sessizce atlayamaz, olmayan metin uyduramaz, çıktı
   biçimini bozamaz. Üretici modele "isimleri listele" dediğinizde model
   uydurabilir, atlayabilir, biçimi bozabilir — ve maskelemede **atlanan bir
   isim doğrudan kimlik sızıntısıdır**. Burada yetenek değil, *yapısal
   kaçınılmazlık* istiyoruz.
3. **Ölçülmüş kalite.** F1 0,925 (PER/LOC/ORG). 2–4 B üretici modeller için
   Türkçe NER'de karşılaştırılabilir ölçüm yok — yani daha iyi olduğu iddiası
   dayanaksız olurdu.

**Bilinen açık:** BERTurk NER'in etiket kümesi PER / LOC / ORG. Bizim
`ADRES` ve `ISYERI` tiplerimiz bire bir karşılık bulmuyor (`LOC` kısmen örtüyor).
Kapatma yolu, öncelik sırasıyla:
1. Kural katmanı ipuçları (`Mah.`, `Sok.`, `No:`, `AVM`, `Plaza`) — **uygulandı**,
   model olmadan da çalışır;
2. Kendi etiket kümemizle küçük bir fine-tune (bkz. `TRAINING.md`) — ileride.

### 3.2 Telefon — üretim: **2 B sınıfı, Q4**

**Seçim:** Qwen3.5-2B sınıfı bir model, Q4 (~1,2 GB), 4–8 K çalışma penceresi.
4 B sınıfı (Qwen3.5-4B, Gemma 3n E2B) **ikinci aday**: 2026 amiral gemisi
telefonlar ~4 B Q4'ü kaldırıyor, ama NER modeli + uygulama + KV önbelleği ile
birlikte 1,2 GB bütçesi zorlanıyor. Karar kalibrasyon turundan (`CAPABILITIES.md`
§C.0) sonra cihaz sınıfına göre verilebilir: bütçe elverirse 4 B, elvermezse 2 B.

**Lisans uyarısı:** Gemma türevleri (Turkish-Gemma, Gemma 3n) **Gemma Terms of
Use** altındadır — OSI onaylı açık kaynak değildir, kullanım kısıtları ve
dağıtım yükümlülükleri vardır. App Store paketine gömülmeden önce hukuki
inceleme şart. Qwen3.5 ve Llama 3.2 kendi lisans metinlerine tabidir. Bu satır
`tahmin` değil `dikkat` maddesidir: hepsi teyit edilecek.

### 3.3 Masaüstü — **Mizan-27B (isteğe bağlı)**

**Seçim:** Mizan-27B, Q4_K_M (~16 GB), yalnız masaüstünde
(`CAPABILITIES.md` B1 — bölünemez yerleşik bellek).

Gerekçe: Türk hukukuna özel eğitilmiş tek aday bu. Ama **hiçbir özellik buna
bağlanmaz**: masaüstü hiç kurulmasa telefon tüm işleri bitirir (PROTOCOL G7).
Mizan bir kalite yükseltmesidir, bir bağımlılık değil.

**Kendi uyarısını ciddiye alıyoruz:** model kartı var olmayan kanun ve karar
üretebileceğini söylüyor. Bu yüzden Mizan çıktısı, A6 araştırma katmanının
**yerel dizininden doğrulanmadan** kullanıcıya içtihat olarak sunulmaz. Atıf
doğrulaması modelin işi değil, bizim işimiz.

### 3.4 Turkish-Gemma-9b neden seçilmedi

- **Telefonda çalışmıyor:** 9 B Q4 ≈ 5,5 GB, 1,2 GB bütçenin dört katından fazla.
- **Masaüstünde Mizan'ın gerisinde:** genel Türkçe üretim modeli, hukuka özel
  değil. Masaüstünde zaten bellek sıkıntısı yokken 27 B hukuk modeli varken
  9 B genel model seçmek için sebep yok.
- **Lisansı daha kısıtlı:** Gemma Terms, Qwen tabanlı alternatiflere göre
  dağıtımda daha çok yükümlülük getiriyor.

Yine de **yedek adaydır**: Mizan'ın lisansı veya kalitesi elenirse, masaüstü
tarafında Turkish-Gemma-9b-T1 ilk alternatiftir.

---

## 4. Fine-tuning ile başlanmıyor (M8.6)

Üslup öğrenme sırası `CAPABILITIES.md` A8 ve plan M8'de tanımlı:
**(a) yapı/iskelet çıkarma → (b) üslup profili JSON → (c) few-shot.**
Fine-tuning en sona bırakıldı, gerekçesi:

1. **Veri yok.** LoRA için anlamlı bir alt sınır birkaç yüz örnektir. Kullanıcının
   eski dilekçeleri bu sayıya ulaşana kadar few-shot zaten daha iyi sonuç verir.
2. **Geri alınamaz.** Few-shot'ta bağlamı değiştirirsiniz, biter. Fine-tune'da
   ağırlıkları değiştirirsiniz; kötü çıkarsa yeniden eğitmek gerekir.
3. **Telefonda eğitilemez.** Eğitim `CAPABILITIES.md` B2 — bölünemez bellek.
   Fine-tuning'e bel bağlamak, telefon-öncelikli kuralı çiğnemek olur.
4. **Ölçemeden ayarlanmaz.** Üslup profili + few-shot çalışırken çıktı kalitesi
   ölçülür; ancak o ölçüm varsa fine-tuning'in bir şey kattığı söylenebilir.

Ayrıntı: `docs/TRAINING.md` (plan M9).

---

## 5. Doğrulanacaklar listesi

Ağ erişimi açıldığında model kartlarından teyit edilecek:

- [ ] Mizan-27B lisansı ve temel model lisansının devri
- [ ] Mizan-27B bağlam uzunluğu ve gerçek Q4_K_M dosya boyutu
- [ ] Turkish-Gemma-9b'nin tam lisans metni ve dağıtım yükümlülükleri
- [ ] `savasy/bert-base-turkish-ner-cased` lisansı ve etiket kümesi
- [ ] BERTurk NER'in Core ML / ONNX'e int8 dönüşümünde F1 kaybı
- [ ] Qwen3.5-2B/4B lisansı ve Türkçe hukuki metin başarımı (kendi ölçümümüz)
- [ ] Seçilen üretim modelinin cihazda ölçülen token/sn değeri (§C.0 kalibrasyonu)

---

## Kaynaklar

- [AlicanKiraz0/Mizan-27B-Turkish-Legal-LLM-Q4_K_M-GGUF](https://huggingface.co/AlicanKiraz0/Mizan-27B-Turkish-Legal-LLM-Q4_K_M-GGUF)
- [Mizan-27B: New Open-Source AI Model Debuts for Turkish Law — ShiftDelete.Net](https://en.shiftdelete.net/mizan-27b-new-open-source-ai-model-debuts-for-turkish-law/)
- [ytu-ce-cosmos/Turkish-Gemma-9b-v0.1](https://huggingface.co/ytu-ce-cosmos/Turkish-Gemma-9b-v0.1)
- [ytu-ce-cosmos/Turkish-Gemma-9b-T1](https://huggingface.co/ytu-ce-cosmos/Turkish-Gemma-9b-T1)
- [savasy/bert-base-turkish-ner-cased](https://huggingface.co/savasy/bert-base-turkish-ner-cased)
- [akdeniz27/bert-base-turkish-cased-ner](https://huggingface.co/akdeniz27/bert-base-turkish-cased-ner)
- [savasy/Turkish-Bert-NLP-Pipeline](https://github.com/savasy/Turkish-Bert-NLP-Pipeline)
- [The Best Open-Source Small Language Models (SLMs) in 2026 — BentoML](https://www.bentoml.com/blog/the-best-open-source-small-language-models)
- [Awesome Mobile LLMs](https://github.com/stevelaskaridis/awesome-mobile-llm)
- [Awesome Turkish Language Models](https://github.com/kesimeg/awesome-turkish-language-models)
