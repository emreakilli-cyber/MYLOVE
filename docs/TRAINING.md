# TRAINING — LoRA/QLoRA eğitimi

Plan M9 (`CAPABILITIES.md` B2 — bölünemez yerleşik bellek, B listesi).

> **Doğrulama notu** (`MODEL.md`'deki gibi): her sayısal değer `doğrulandı` /
> `ikincil kaynak` / `tahmin` işaretlidir. Bu belge yazılırken ağ erişimi açıktı
> ve birkaç kaynak taranabildi (bkz. Kaynaklar), ama hiçbiri Mizan-27B'nin
> **kendi** eğitim/VRAM ölçümü değil — 7B/13B/14B/30B/70B sınıfı modellerin
> ölçümünden 9B/27B'ye **enterpolasyondur**. Karara dayanak yapılan tek şey
> M0 — fine-tuning'in ilk adım olmadığı kararı — zaten ölçüme muhtaç değil.

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

## 1. Veri formatı (M9.1)

Eğitim kaydı, `write/staged.ts`'in `SectionRequest`/`GeneratedSection`
çiftiyle **birebir** hizalı — böylece aynı veri hem few-shot bağlamı (M8.5)
hem de fine-tuning örneği olarak kullanılabilir, iki ayrı biçim icat
edilmez. JSONL, satır başına bir kayıt:

```jsonc
{
  "id": "doc-014-sec-03",
  "task": "section_generation",
  "instruction": "Aşağıdaki bölüm başlığı ve olgu referanslarına göre, verilen üslup profiliyle tutarlı bir dilekçe bölümü yaz.",
  "context": {
    "heading": "SONUÇ VE İSTEM",
    "factRefs": ["fact-07", "fact-12"],
    "styleHints": {
      "sentenceLengthMean": 18.4,
      "paragraphLengthMean": 3.1,
      "numberingStyle": "arabic-dot",
      "boilerplatePhrases": ["yukarıda arz ve izah edilen nedenlerle", "saygılarımla arz ve talep ederim"],
      "termPreferences": ["davacı", "müvekkil", "istinaf"]
    },
    "fewShotExamples": [
      { "heading": "SONUÇ VE İSTEM", "text": "[KISI_1] vekili olarak, yukarıda arz ve izah edilen nedenlerle..." }
    ]
  },
  "output": "Yukarıda arz ve izah edilen nedenlerle, [KISI_1] vekili sıfatıyla, [KURUM_1] aleyhine açılan işbu davanın kabulü ile..."
}
```

**Zorunlu alan kuralı:** `context.styleHints`, `write/styleProfile.ts`'in
`StyleProfile`'ından **türetilir** (tüm alanları değil, yalnız özet
istatistikler — ham `sampleParagraphs` eğitim kaydına kopyalanmaz, çünkü o
zaten kaynak belgenin ta kendisidir ve tekrar tekrar aynı örneği ezberletir).
`output` **maskelenmiş** metindir — SPEC'teki `[TIP_N]` token'larını olduğu
gibi taşır. Bu kasıtlı: model, maske token'larını serbest metinmiş gibi
koruyarak üretmeyi öğrenir; gerçek isim/TCKN/IBAN modelin **hiçbir**
aşamasından geçmez (M9.2).

## 2. Veri hazırlama (M9.2)

```
kullanıcının onayladığı eski dilekçeler (zaten cihazda, maskelenmiş)
        │
        ▼  extractSkeleton + addDocument (M8.2–M8.4, ÇALIŞAN kod, yeniden yazılmaz)
   StyleProfile + bölüm bölüm ayrıştırılmış maskelenmiş metin
        │
        ▼  bölümleri SectionRequest/GeneratedSection çiftine indirger
   eğitim adayı kayıtlar (§1 şeması)
        │
        ▼  preflightCheck / findUnmaskedContent (M11, M7.3) — SON KAPI
   yalnız guard'dan TEMİZ geçen kayıtlar JSONL'e yazılır
        │
        ▼
   eğitim seti (yalnız bu dosya GPU'ya / kiralık makineye gider)
```

**Değişmez kural (görev talimatının "hiç yazma" ilkesiyle birebir):** JSONL
üretim adımı, `research/guard.ts`'deki **aynı** `findUnmaskedContent`
taramasını kayıt yazılmadan hemen önce çalıştırır. Guard bir bulgu
görürse o kayıt **atlanır**, dosyaya hiç yazılmaz — "yaz sonra temizle"
değil. Bu, paketin kendi kod tabanında zaten var olan bir fonksiyonun
tekrar kullanılmasıdır (yeni kod gerekmez, M9 bu belgeye yeni bir
zorlayıcı kontrol **eklemiyor**, var olanı **yeniden kullanıyor** — kırmızı
çizgi `ARCHITECTURE.md` §6'daki gibi burada da kod incelemesiyle + mevcut
`guard.test.ts` kapsamıyla korunur).

Eğitim seti dosyası kullanıcının cihazında/masaüstünde kalır; bu belgenin
kapsamı **yalnız veri hazırlama akışıdır**, dosyanın nereye kopyalandığı
(local disk / kiralık GPU'ya yükleme) kullanıcının kendi işletim kararıdır —
paket bunu otomatikleştirmez, `PROTOCOL.md`'nin devir mekanizmasından ayrıdır
(eğitim, iş kuyruğunun bir parçası değil, isteğe bağlı bir kalite
yükseltmesi hazırlığıdır).

## 3. Örnek sayısı (M9.3)

*(tahmin — Mizan-27B'ye özgü doygunluk ölçümü yok; genel LoRA/QLoRA stil
uyarlaması literatüründen alt sınır)*

| Aralık | Beklenen sonuç |
|---|---|
| < 50 | Anlamlı üslup öğrenmesi olası değil; few-shot (M8.5) her zaman eşit/daha iyi — eğitime başlanmaz |
| 100–300 | Alt sınır; belirgin ama tutarsız üslup benzerliği beklenir |
| 300–1.000 | Önerilen aralık — bir hukuk bürosunun birkaç yıllık dilekçe arşivi tipik olarak bu bandı doldurur |
| 1.000–3.000 | Doygunluğa yaklaşılır; ek örnek marjinal fayda getirir, getirmeyebilir de |
| > 3.000 | Stil-uyarlama görevi için genellikle gereksiz — bu ölçek bilgi enjeksiyonu (yeni hukuk bilgisi öğretme) için anlamlı olur, üslup öğrenmek için değil; **M9 kapsamı yalnız üslup**, bilgi enjeksiyonu B2'nin de dışındadır |

**Doygunluk noktası ölçülmeden tahmin edilmez (M8.6 §4 ile aynı ilke):**
kullanıcı 300 örnekle eğitip M9.8'deki değerlendirmeyi koşmalı, sonucu
beğenmezse örnek sayısını artırıp tekrar denemelidir. Bu belge bir sayı
**vaat etmez**, bir başlangıç noktası önerir.

## 4. Hiperparametreler (M9.4)

*(ikincil kaynak — LoRA/QLoRA pratiğinde yaygın aralıklar; Unsloth
hiperparametre kılavuzu ve ilgili literatür)*

| Parametre | Önerilen değer | Gerekçe |
|---|---|---|
| `rank (r)` | 16–32 | Görev "yeni bilgi öğretme" değil "üslup uyarlama" — düşük-orta rank yeterli; küçük veri setinde (§3) yüksek rank ezberlemeyi (overfitting) artırır |
| `alpha` | `2 × rank` (32–64) | Yaygın pratik; güncelleme büyüklüğünü rank ile orantılı tutar |
| `dropout` | 0,05–0,10 | Küçük veri setinde ezberlemeye karşı hafif düzenlileştirme |
| `öğrenme oranı` | `1e-4`–`2e-4` | LoRA adaptörleri için tipik aralık; taban model donmuş olduğundan tam ince ayardan yüksek LR'ye toleranslı |
| `epoch` | 2–3 | Küçük veri setinde (300–1.000 örnek) fazla epoch hızla ezberlemeye döner; 1 epoch bazı çalışmalarda en iyi sonucu veriyor — 2–3 güvenli bir orta nokta |
| `batch size` (fiziksel) | 1–4 | VRAM bütçesine bağlı (§5); GPU belleği zorlanıyorsa 1'e düşürülür |
| `gradyan biriktirme` | 8–16 adım | Fiziksel batch küçükken **etkin** batch'i 16–32'ye çıkarır; eğitim kararlılığı için |
| Optimizer | AdamW (8-bit, `bitsandbytes`) | Bellek tasarrufu; QLoRA'nın standart eşlik ettiği optimizer |

**Bu tablo bağlayıcı değil, başlangıç noktasıdır** — `MODEL.md`'nin kararları
gibi bir sözleşme değil, M9.8'deki ölçümle ayarlanacak bir öneridir.

## 5. Donanım gereksinimi (M9.5)

*(ikincil kaynak, doğrulanmış nokta değerler 7B/13B/14B/30B/70B; 9B/27B
enterpolasyon — **tahmin** işaretli)*

| Model | Tam hassasiyet (fp16) yükleme | LoRA (fp16 taban + eğitilebilir adaptör) | QLoRA (4-bit taban + adaptör) |
|---|---|---|---|
| 7B | ~14 GB | ~16–18 GB *(ikincil kaynak)* | **~12 GB** *(ikincil kaynak, doğrulanmış nokta)* |
| 9B | ~18 GB | ~20–24 GB *(tahmin, enterpolasyon)* | **~14–16 GB** *(tahmin, enterpolasyon)* |
| 13–14B | ~26–28 GB | ~30–34 GB *(tahmin)* | **~20–22 GB** *(ikincil kaynak, doğrulanmış nokta)* |
| 27B (**Mizan**) | ~54 GB | **~60–70 GB** *(tahmin, enterpolasyon)* | **~42–46 GB** *(tahmin, enterpolasyon)* |
| 30–32B | ~60–64 GB | ~66–74 GB *(tahmin)* | **~44 GB** *(ikincil kaynak, doğrulanmış nokta)* |

**Pratik sonuç:** Mizan-27B için **QLoRA zorunlu tercih**, LoRA (kuantizasyonsuz)
değil — LoRA'nın 60–70 GB'lık gereksinimi tek kart üzerinde (bu sınıfta en
yaygın kart 24 GB veya 80 GB) ya çok GPU ya da doğrudan A100/H100 80 GB
gerektirir; QLoRA'nın ~42–46 GB'ı tek bir **80 GB kart** (A100/H100) içine
rahatça, teorik olarak iki adet 24 GB kart içine (model paralelliğiyle,
ekstra karmaşıklıkla) sığar. **Tek 24 GB tüketici kart (RTX 4090 sınıfı)
Mizan-27B'yi QLoRA ile bile eğitemez** — bu donanımla gerçekçi seçenek,
masaüstü modeli olarak zaten seçilmemiş olan 9B sınıfı bir modeli (`MODEL.md`
§3.4'teki yedek aday) denemektir, ya da kiralık GPU'ya geçmektir (§6).

## 6. Tahminî süre ve maliyet (M9.6)

**Süre formülü** (ölçülmeden önce yalnız kabaca):

```
adım sayısı  = (örnek_sayısı / etkin_batch) × epoch
etkin_batch  = fiziksel_batch × gradyan_biriktirme  (§4: tipik 16–32)
toplam_süre  = adım_sayısı × adım_başı_süre
```

`adım_başı_süre` GPU'ya, dizi uzunluğuna ve fiziksel batch'e göre değişir ve
**ölçülmeden bilinmez** — bu belge bir tahmin ARALIĞI verir, kesin sayı
vermez (`MODEL.md`'nin kalibrasyon ilkesiyle aynı: tahmin, ölçüm gelene kadar
geçerli bir yer tutucudur).

*Örnek hesap (700 örnek, 3 epoch, etkin batch 16 → ~130 adım):*

| Ortam | Adım başı süre *(tahmin)* | Toplam süre *(tahmin)* | Saatlik ücret | Toplam maliyet *(tahmin)* |
|---|---|---|---|---|
| Yerel GPU (A100/H100 80 GB varsa) | ~2–5 sn | ~5–11 dk eğitim + ~15–30 dk kurulum/yükleme/değerlendirme | — (elektrik hariç sıfır) | 0 ₺ (donanım zaten varsa) |
| Kiralık A100 80 GB *(RunPod, ikincil kaynak, 2026)* | ~2–5 sn | ~20–40 dk (kurulumla birlikte) | **~1,79 $/sa** | **~0,6–1,2 $** |
| Kiralık H100 80 GB *(RunPod, ikincil kaynak, 2026)* | ~1–3 sn | ~15–30 dk | **~2,69–2,89 $/sa** | **~0,7–1,4 $** |

**Dürüst not:** Tek eğitim koşusunun kendisi ucuz (~1–2 $, birkaç saat
içinde bitiyor) — asıl maliyet **deneme-yanılmadır**: hiperparametre
ayarlama, veri setini büyütme, M9.8 değerlendirmesiyle birkaç tur tekrar
etme. Kullanıcı bunu birkaç $–birkaç on $ aralığında, birkaç oturumda
bitecek bir iş olarak planlamalı, tek seferlik büyük bir yatırım olarak
değil.

## 7. Adım adım çalıştırma yönergesi (M9.7)

Bu adımlar **kullanıcının kendi masaüstünde veya kiralık GPU'da** koşulur;
paketin (`packages/hukuk-ai`) hiçbir kodu bu adımları otomatikleştirmez —
M9.2'deki JSONL üretimi dışında eğitim tamamen paket sınırlarının dışındadır.

1. **Ortam kur.**
   ```
   python -m venv .venv && source .venv/bin/activate
   pip install "unsloth[cu121-torch230]" transformers peft bitsandbytes accelerate datasets
   ```
   *(sürüm/CUDA etiketleri kart ve sürücüye göre değişir; `unsloth`
   kurulum kılavuzu güncel eşleşmeyi verir.)*
2. **Taban modeli edin.** Mizan-27B'nin **GGUF** dağıtımı (`MODEL.md`
   kaynaklarındaki `Q4_K_M-GGUF`) doğrudan eğitilemez — GGUF çıkarım
   formatıdır, gradyan taşımaz. Eğitim için modelin özgün `safetensors`
   ağırlıkları (kuantize edilmemiş taban) gerekir; bu, model sayfasında
   ayrı bir dosya kümesi olarak yayınlanmışsa oradan indirilir. **Bulunamazsa
   M9 burada durur** — GGUF'tan eğitim mümkün değildir, `docs/BLOCKED.md`'ye
   yazılacak bir engel budur.
3. **Veri setini hazırla.** §1–§2'deki JSONL dosyasını `train.jsonl` /
   `eval.jsonl` (ör. %90/%10 bölünmüş) olarak ayır.
4. **LoRA yapılandırmasını yaz** (§4'teki değerlerle):
   ```python
   from peft import LoraConfig
   lora_config = LoraConfig(
       r=24, lora_alpha=48, lora_dropout=0.08,
       target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
       task_type="CAUSAL_LM",
   )
   ```
5. **4-bit yükle ve eğit** (`bitsandbytes` `BitsAndBytesConfig(load_in_4bit=True)`
   ile taban model yüklenir, `peft.get_peft_model` ile adaptör eklenir,
   `transformers.Trainer` veya `trl.SFTTrainer` ile §4'teki
   `learning_rate`/`num_train_epochs`/`gradient_accumulation_steps` verilerek
   eğitim başlatılır).
6. **Adaptörü kaydet, tabanla birleştirme.** Eğitim çıktısı (LoRA adaptör
   ağırlıkları, birkaç yüz MB) ayrı saklanır; **tabanla birleştirilmiş** tek
   bir model üretmek istenirse `merge_and_unload()` çalıştırılır — ama
   birleştirme geri alınamaz bir kopya üretir, orijinal adaptör ayrıca
   saklanmalıdır (M9.8 geri alma bunu gerektirir).
7. **Masaüstü işçisine bağla.** Üretilen model, `write/staged.ts`'in
   `WriteBackend` arayüzünü uygulayan bir masaüstü adaptörüne (paketin
   dışında, host uygulamanın parçası) verilir — paket kodu **değişmez**,
   yalnız hangi `WriteBackend` uygulamasının enjekte edildiği değişir
   (`ARCHITECTURE.md` §4'teki "arayüzle bakar, kod olarak sahip değildir"
   ilkesi).

## 8. Değerlendirme (M9.8)

**Kalite nasıl ölçülür — üç bağımsız sinyal, biri yeterli değil:**

1. **Otomatik — üslup uyumu.** Üretilen bölümler `write/styleProfile.ts`'in
   `addDocument`'ından geçirilip çıkan istatistikler (cümle/paragraf uzunluğu,
   kalıp ifade oranı) kaynak `StyleProfile`'la karşılaştırılır. Kod zaten var,
   yeni bir ölçüm aracı yazılmaz.
2. **Otomatik — tutarlılık.** `write/staged.ts`'in `reviewConsistency`'si
   zaten bölümler arası çelişki/tekrarı denetliyor (A13 §3); fine-tuned
   backend ile few-shot-only backend'in ürettiği çıktılar üzerinde **aynı**
   fonksiyon koşulup `ConsistencyIssue` sayıları karşılaştırılır.
3. **İnsan — kör karşılaştırma.** Kullanıcıya (avukata) aynı olay özeti için
   iki çıktı gösterilir — biri fine-tuned model, biri yalnız few-shot (M8.5) —
   hangisinin kaynağı olduğu söylenmeden. Tercih oranı **> %60** değilse
   eğitim "kattığı bir şey yok" sayılır (M8.6 §4'teki "ölçemeden ayarlanmaz"
   ilkesinin doğal sonucu: ölçüm negatifse fine-tuning'i tutmanın gerekçesi
   kalmaz).

**Geri alma nasıl yapılır — tasarım gereği ucuz:**

Fine-tuned model, `WriteBackend` arayüzünün **bir** uygulamasıdır
(`ARCHITECTURE.md` §4). Geri alma, adaptörü silmek değil, host uygulamanın
hangi `WriteBackend`'i enjekte ettiğini few-shot-only varsayılana
**döndürmektir** — tek satırlık bir yapılandırma değişikliği, veri kaybı
yok, şema göçü yok. §7 madde 6'daki ayrı-saklanan adaptör dosyası da
istenirse silinir; hiçbir iz paketin kendi state'inde kalmaz (paket zaten
hangi backend'in bağlı olduğunu bilmez, yalnız arayüzü bilir).

---

## Kaynaklar

`§3`, `§4`, `§5`, `§6`'daki ikincil-kaynak/tahmin değerlerin dayandığı
taramalar (Mizan-27B'ye özgü doğrulanmış ölçüm değil; genel LoRA/QLoRA
pratiği ve GPU kiralama fiyatları):

- [Mistral 7B: QLoRA Fine-tuning + 4-bit (Q4/NF4/INT4) VRAM Usage — Kaitchup](https://kaitchup.substack.com/p/mistral-7b-recipes-for-fine-tuning)
- [LLM Fine-Tuning Hardware Requirements: VRAM, GPU](https://llmhardware.io/guides/llm-fine-tuning-hardware-requirements)
- [How much VRAM do I need for LLM model fine-tuning? — Modal](https://modal.com/blog/how-much-vram-need-fine-tuning)
- [GPU VRAM Requirements to Fine-Tune LLMs in 2026 — Spheron](https://www.spheron.network/blog/gpu-vram-requirements-fine-tune-llm-2026/)
- [LoRA fine-tuning Hyperparameters Guide — Unsloth Documentation](https://unsloth.ai/docs/get-started/fine-tuning-llms-guide/lora-hyperparameters-guide)
- [LoRA Done Right: Recommendations for Near Full Fine-Tuning Performance — Medium](https://medium.com/@bnjmn_marie/lora-done-right-recommendations-for-near-full-fine-tuning-performance-311e7be5d4be)
- [RTX 4090 GPU Rental | Specs and Pricing — Runpod](https://www.runpod.io/gpu-models/rtx-4090)
- [Cloud GPU Pricing 2026: A100 $1.99/hr, H100 $3.29/hr+ — SynpixCloud](https://www.synpixcloud.com/blog/cloud-gpu-pricing-comparison-2026/)

**Doğrulanacaklar (ağ tekrar kapandığında veya gerçek eğitim koşusundan
önce teyit edilecek, `MODEL.md` §5'e ek):**

- [ ] Mizan-27B'nin özgün (kuantize edilmemiş) `safetensors` ağırlıkları
      yayınlanmış mı, yoksa yalnız GGUF mı dağıtılıyor (§7 madde 2'nin
      koşulu)
- [ ] §5 tablosundaki 9B/27B VRAM değerleri gerçek bir QLoRA koşusuyla
      teyit edilmeli — bu tablo enterpolasyondur, ölçüm değil
- [ ] §6'daki adım-başı-süre tahmini, ilk gerçek koşudan sonra bu belgeye
      ölçülmüş değerle geri yazılmalı (`MODEL.md`'nin kalibrasyon ilkesiyle
      aynı: tahmin, ölçüm gelene kadar geçerli bir yer tutucudur)
