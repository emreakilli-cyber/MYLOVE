# TRAINING — LoRA/QLoRA eğitim rehberi

Plan M9. `CAPABILITIES.md` B2: eğitim, bölünemez yerleşik bellek gerektirir,
bu yüzden **masaüstüne** aittir (`MODEL.md` §3.3 — Mizan-27B masaüstü, isteğe
bağlı kalite yükseltmesi).

> **Doğrulama notu.** `MODEL.md`'deki gibi: bu ortamda ağ erişimi
> kısıtlı olduğu için güncel GPU kiralama fiyatları ve spesifik model kartı
> rakamları **doğrudan teyit edilemedi**. LoRA/QLoRA'nın genel bellek
> aritmetiği ve eğitim pratiği (rank/alpha oranı, QLoRA'nın 4-bit taban +
> fp16 adaptör yapısı) yaygın, kararlı, kaynağa bağlı olmayan teknik
> bilgidir — bunlar doğrudan verildi. Fiyat ve tam VRAM rakamları `tahmin`
> işaretlidir ve **kullanmadan önce ölçülmeli/teyit edilmelidir** — tıpkı
> `CAPABILITIES.md` §C.0'ın "tahminle değil ölçümle" ilkesi gibi.

---

## 0. Fine-tuning ile başlanmıyor (M8.6)

Üslup öğrenme sırası `CAPABILITIES.md` A8 ve `PLAN-HUKUKAI.md` M8'de
tanımlıdır: **(a) yapı/iskelet çıkarma → (b) üslup profili JSON → (c)
few-shot seçimi.** Fine-tuning bu sıranın **dışındadır ve en sona
bırakılmıştır**. Gerekçe (`MODEL.md` §4 ile birebir):

1. **Veri yok.** LoRA için anlamlı bir alt sınır birkaç yüz örnektir.
   Kullanıcının eski dilekçe sayısı bu sınıra ulaşana kadar few-shot zaten
   daha iyi sonuç verir — karşılaştırma yapılmadan fine-tuning'e geçmek
   erken optimizasyondur.
2. **Geri alınamaz.** Few-shot'ta bağlamı değiştirirsiniz, iş biter; kötü
   sonuç bir sonraki çağrıda düzelir. Fine-tune'da model ağırlıklarını
   değiştirirsiniz; kötü çıkarsa yeniden eğitmek gerekir — pahalı ve yavaş
   bir geri alma.
3. **Telefonda eğitilemez.** Eğitim `CAPABILITIES.md` B2'dir — taban model +
   gradyanlar + optimizasyon durumu **aynı anda** bellekte gerekir, bu
   bölünemez bir yerleşik bellek sınırıdır. Fine-tuning'e bel bağlamak,
   "telefon her işi tek başına bitirir" (`PROTOCOL.md` G7) ilkesini
   masaüstüne bağımlı kılardı.
4. **Ölçemeden ayarlanmaz.** Üslup profili (A8) + few-shot (A9) çalışırken
   çıktı kalitesi ölçülebilir hâle gelir; fine-tuning'in gerçekten bir şey
   kattığı ancak o ölçüm elde varken söylenebilir. Ölçüm yokken hiperparametre
   seçmek (rank, alpha, epoch) tahminden ibaret kalır.

Bu karar `MODEL.md` §4'te de yazılıdır; iki belge birbirine atıf yapar,
çelişmez.

---

## 1. Veri formatı (M9.1)

JSONL — her satır bir eğitim kaydı, `write/generate.ts`'nin prompt/çıktı
biçimiyle **kasıtlı olarak aynı şekilde**. Böylece few-shot'tan LoRA'ya
geçiş bir format değişikliği değil, aynı çiftlerin ölçek büyütmesi olur:

```json
{"instruction": "Plan ve olgulara dayanarak belirtilen bölümü hukuki dilekçe üslubunda yaz.",
 "input": "Plan: 1. KONU > 2. AÇIKLAMALAR > 3. SONUÇ VE İSTEM\nYazılacak bölüm: 1. KONU\nOlgular:\n- [KISI_1], [KURUM_1] nezdindeki alacağının tahsilini talep ediyor\nÜslup: ortalama cümle uzunluğu 14.2 kelime; kapanış: \"Saygılarımla.\"",
 "output": "İş bu dilekçe ile müvekkilimiz [KISI_1]'in, [KURUM_1] nezdindeki alacağının tahsili talep olunmaktadır.",
 "section_type": "KONU",
 "source_document_id": "belge-0142"}
```

| Alan | Zorunlu | Anlam |
|---|---|---|
| `instruction` | evet | Sabit görev tanımı; bölüm türüne göre birkaç varyant yeterli |
| `input` | evet | `buildSectionPrompt`'un ürettiğiyle aynı biçim: plan + olgular + üslup özeti + (varsa) few-shot |
| `output` | evet | Gerçek dilekçenin o bölümdeki **maskelenmiş** metni — hedef çıktı |
| `section_type` | hayır | Değerlendirmede bölüm türüne göre kırılım almak için |
| `source_document_id` | hayır | İzlenebilirlik — **içerik değil**, yalnız hangi belgeden geldiği; ham metne veya kimliğe geri götürmez |

`output` alanı **her zaman** maskelenmiş metindir — token'lar (`[KISI_1]`
gibi) olduğu gibi kalır. Model, gerçek adı değil, token'ı doğru yerde
kullanmayı öğrenir; bu, `SPEC.md` S1/S3'ün eğitim verisine yansımasıdır.

---

## 2. Veri hazırlama (M9.2)

```
eski dilekçe (ham metin, cihazda)
      │
      ▼  mask()                                    ← SPEC §6, bu paketin kendi fonksiyonu
maskelenmiş metin + MaskTable (yalnız bellekte)
      │
      ▼  extractSkeleton()                         ← write/skeleton.ts
başlıklar + bölüm sınırları
      │
      ▼  her bölüm için:
      │    - output  = bölümün maskelenmiş metni
      │    - input   = buildSectionPrompt(...) ile AYNI biçimde üretilmiş bağlam
      │                (plan başlıkları + o bölüme ait olgular + extractStyleProfile
      │                 özeti — olgular ayrı bir çıkarım adımı gerektirir, M8'in
      │                 kapsamı dışındadır, bu doküman yalnız BİÇİMİ tanımlar)
      ▼
JSONL satırı (yalnız maskelenmiş metin + üstveri; MaskTable ASLA yazılmaz)
```

**Değişmez kural:** `MaskTable`'ın kendisi (gerçek değer ↔ token eşlemesi)
JSONL'e **hiçbir alanda** yazılmaz — bu, `SPEC.md` S2 ve `PROTOCOL.md` G1'in
eğitim verisi hattına genişlemesidir. Eğitim seti diskte durur, muhtemelen
kiralık bir GPU'ya taşınır (§6); dolayısıyla **ham müvekkil verisi bu hatta
hiçbir aşamada, hiçbir ara dosyada bulunmaz** — "yaz sonra sil" değil, SORU
başlığındaki (`SORULAR.md` disiplini) gibi baştan hiç üretilmemesi ilkesi.

Bir dilekçe hazırlama hattına girdiğinde tek koşul: `mask()` başarıyla
koşmuş olması (S3 — koşamazsa o belge eğitim setine hiç girmez, atlanır,
hata olarak işaretlenir).

---

## 3. Örnek sayısı (M9.3) — *tahmin, ölçülerek doğrulanmalı*

| Eşik | Değer | Gerekçe |
|---|---|---|
| Alt sınır | ~150–300 kayıt | Bunun altında LoRA adaptörü, gürültüden anlamlı üslup sinyalini ayıramaz; genel LoRA pratiğinde kabul gören alt sınır aralığı |
| Önerilen aralık | 500–2.000 kayıt | Tek bir büro/avukatın üslubu **dar bir dağılımdır** (genel amaçlı talimat ayarından farklı olarak yeni bilgi değil, üslup öğretiliyor) — bu, birkaç yüz-birkaç bin örnekle doygunlaşan görevlerdendir |
| Doygunluk noktası | ~2.000–5.000 kayıt | Bunun ötesinde getiri azalır; tekrarlanan kalıp ifadeler ve sabit başlık düzeni zaten birkaç yüz örnekte örneklenmiş olur |

**Ölçüm kuralı (`CAPABILITIES.md` §C.0'ın burada karşılığı):** sabit bir
sayıya güvenilmez; doğrulama kaybı (validation loss) eğrisi platoya
oturduğunda durulur (§8'deki erken durdurma). Yukarıdaki sayılar başlangıç
noktasıdır, karar verici değil.

**Few-shot ile karşılaştırma eşiği:** kullanıcının eski dilekçe sayısı alt
sınırın (150–300) altındaysa fine-tuning'e hiç girilmez — A8/A9 (üslup
profili + few-shot) zaten daha iyi sonuç verir (§0, madde 1).

---

## 4. Hiperparametreler (M9.4) — *tahmin, QLoRA için*

| Parametre | Önerilen | Gerekçe |
|---|---|---|
| `rank` (r) | 16–32 | Görev **yeni bilgi değil, üslup** öğretiyor; yüksek rank (64+) bilgi-yoğun görevler içindir, üslup transferinde gereksiz kapasite = ezber (overfitting) riski |
| `alpha` | `2 × rank` (r=16 → α=32) | Yaygın pratik oran; adaptör çıktı ölçeğini taban modelle dengeler |
| `dropout` | 0,05–0,10 | 500–2.000 örneklik küçük veri setinde ezberi frenler |
| Öğrenme oranı | 1e-4 – 2e-4 | LoRA adaptörleri için taban modelden çok daha yüksek oran gerekir (yalnız küçük ek matrisler güncelleniyor); paged AdamW 8-bit optimizasyon önerilir (QLoRA) |
| Epoch | 2–3 | Dar, tekrarlı bir üslup korpusunda 3-4 epoch'un üzerinde ezber riski hızla artar |
| Batch (cihaz başına) | 1–4 | VRAM'e bağlı (§5); küçükse gradyan biriktirmeyle telafi edilir |
| Gradyan biriktirme | 8–16 adım | Etkin batch'i ~16–32'ye çıkarır, VRAM'i büyütmeden |
| Dizi uzunluğu | 1.024–2.048 token | `SECTION_CONTEXT_CHAR_BUDGET` (~2.000 token, `write/generate.ts`) ile tutarlı — eğitim ve çıkarım aynı bağlam bütçesini paylaşır |

**Erken durdurma:** doğrulama kaybı 1 epoch boyunca iyileşmezse dur — sabit
epoch sayısına körü körüne güvenmemek, §3'teki "ölçülerek doğrula" ilkesinin
devamıdır.

---

## 5. Donanım gereksinimi (M9.5) — *kaba tahmin, VRAM*

QLoRA'da taban model 4-bit (≈0,5 bayt/parametre) donmuş yüklenir; yalnız LoRA
adaptörleri (fp16/bf16) ve onların gradyan/optimizör durumu eğitilir. LoRA
(kuantizasyonsuz) ise taban model fp16 (≈2 bayt/parametre) yüklenir —
adaptör ek yükü aynı, ama taban ağırlığı dört kat yer kaplar.

| Model | LoRA (fp16 taban) | QLoRA (4-bit taban) |
|---|---|---|
| 7 B sınıfı | ~26–30 GB | ~8–10 GB |
| 9 B sınıfı | ~32–36 GB | ~10–12 GB |
| 27 B sınıfı (Mizan-27B) | ~100+ GB (pratik değil, çoklu GPU gerekir) | ~20–24 GB |

Rakamlar dizi uzunluğu ~1.024–2.048 token, batch 1–4, gradyan biriktirmeyle
üretilen kaba aralıklardır; kesin değer optimizasyon durumu (paged
AdamW 8-bit vs. standart AdamW), aktivasyon kontrol noktalama (gradient
checkpointing) açık/kapalı olmasına göre değişir. **27 B QLoRA için 24 GB
sınıfı tek bir tüketici kartı (`CAPABILITIES.md` B1'in aksine — çıkarım değil
eğitim burada söz konusu, o yüzden bellek bütçesi farklı) sınırda
çalışabilir**, gradient checkpointing ve küçük batch zorunludur.

---

## 6. Tahminî süre ve maliyet (M9.6) — *tahmin*

### Yerel GPU

| Model × mod | Tipik tüketici kart | 1.000 kayıt × 3 epoch tahmini süre |
|---|---|---|
| 7–9 B QLoRA | 24 GB sınıfı (ör. RTX 4090) | ~2–5 saat |
| 27 B QLoRA | 24 GB sınıfı, sınırda | ~8–14 saat (küçük batch, checkpointing yüzünden yavaş) |

### Kiralık GPU

Bulut GPU kiralama (A100 40/80 GB, H100 sınıfı) yerel donanımdan 2–4× hızlı
olabilir; süre orantılı kısalır (27 B QLoRA ~2–4 saate iner). **Saatlik
fiyat burada verilmiyor** — bu ortamda ağ erişimi sağlayıcı fiyat
sayfalarını teyit edecek şekilde açık değil ve fiyatlar sık değişir; karar
öncesi güncel fiyat sağlayıcıdan doğrudan kontrol edilmelidir. Kaba
planlama için: süre tahminini (yukarıdaki tablo) seçilen sağlayıcının o
anki saatlik fiyatıyla çarpmak yeterlidir.

**Maliyetten kaçınma yolu:** §3'teki alt sınırın altındaki veri setlerinde
fine-tuning'e hiç girilmez — bu, hem kalite hem maliyet açısından
few-shot'un fine-tuning'e tercih edilme gerekçesidir (§0).

---

## 7. Adım adım çalıştırma yönergesi (M9.7)

Aşağıdaki adımlar yaygın açık kaynak araçlarla (Hugging Face `transformers`,
`peft`, `bitsandbytes`, `trl`) yazılmıştır; masaüstü/kiralık GPU ortamında
komut komut çalıştırılabilir. Model adı/yolu, veri yolu gibi yer tutucular
`<...>` ile işaretli.

```bash
# 1) Ortam kurulumu
python -m venv .venv && source .venv/bin/activate
pip install "transformers>=4.44" peft bitsandbytes trl accelerate datasets

# 2) Veri kontrolü — eğitim setinde ham kimlik verisi KALMADIĞINI doğrula.
#    Bu adım M7'nin MaskGuard'ıyla aynı disiplini eğitim verisine uygular:
#    (SPEC kural katmanını burada tekrar koşturan ayrı bir denetim betiği
#    yazılmalı; bu paketin `assertMasked`/`findUnmaskedContent`'i referanstır.)
python check_masked.py --input train.jsonl   # örnek betik adı; assertMasked mantığını uygular
```

```python
# 3) Taban modeli 4-bit yükle (QLoRA)
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
import torch

quant_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_use_double_quant=True,
)
tokenizer = AutoTokenizer.from_pretrained("<taban-model-yolu>")
model = AutoModelForCausalLM.from_pretrained(
    "<taban-model-yolu>", quantization_config=quant_config, device_map="auto",
)
```

```python
# 4) LoRA yapılandırması — §4'teki değerler
from peft import LoraConfig, get_peft_model

lora_config = LoraConfig(
    r=16, lora_alpha=32, lora_dropout=0.05,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],  # dikkat katmanları
    task_type="CAUSAL_LM",
)
model = get_peft_model(model, lora_config)
```

```python
# 5) Eğitim — TRL'nin SFTTrainer'ı, instruction/input/output alanlarını
#    §1'deki JSONL biçiminden tek bir prompt+hedef dizgesine birleştirir.
from datasets import load_dataset
from trl import SFTTrainer, SFTConfig

dataset = load_dataset("json", data_files={"train": "train.jsonl", "validation": "val.jsonl"})

def format_example(example):
    prompt = f"{example['instruction']}\n{example['input']}\n"
    return {"text": prompt + example["output"]}

dataset = dataset.map(format_example)

config = SFTConfig(
    output_dir="./adapter-out",
    per_device_train_batch_size=2,
    gradient_accumulation_steps=8,
    num_train_epochs=3,
    learning_rate=2e-4,
    optim="paged_adamw_8bit",
    gradient_checkpointing=True,
    eval_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    max_seq_length=2048,
)

trainer = SFTTrainer(model=model, args=config, train_dataset=dataset["train"], eval_dataset=dataset["validation"])
trainer.train()
```

```python
# 6) Adaptörü kaydet — taban model DEĞİŞMEDİ, yalnız küçük bir ek dosya var.
model.save_pretrained("./adapter-out/final")
# Birleştirme İSTEĞE BAĞLIDIR (dağıtım kolaylığı için); adaptörü ayrı tutmak
# geri almayı (§8) kolaylaştırır.
```

---

## 8. Değerlendirme (M9.8)

### Otomatik ölçüm — bu paketin kendi araçlarıyla

`write/style.ts`'nin `extractStyleProfile` fonksiyonu **hem eğitim verisi
hazırlamada hem değerlendirmede** kullanılabilir: ayrılmış bir test
kümesindeki gerçek dilekçelerin üslup profiliyle, ince ayarlı modelin
ürettiği taslakların üslup profili karşılaştırılır (ortalama cümle
uzunluğu farkı, kalıp ifade örtüşme oranı, kapanış/hitap eşleşmesi). Bu,
insan değerlendirmesinin yerini tutmaz ama ucuz, tekrarlanabilir bir ilk
elemedir.

### İnsan değerlendirmesi

Bir avukat, ince ayarlı modelin ve yalnız few-shot'un (A9) ürettiği
taslakları **kör** karşılaştırır (hangisinin hangi yöntemden geldiğini
bilmeden). Fine-tuning yalnız bu karşılaştırmada **ölçülebilir bir fark**
gösterirse kalıcı hâle getirilir (§0, madde 4).

### Güvenlik regresyonu — atlanamaz

İnce ayarlı model, maskelenmiş girdi verildiğinde **hâlâ token'ları olduğu
gibi kullanmalı**, gerçek isim/TC/IBAN "uydurmamalı". Bu, `SPEC.md` §5.1'in
model çıktısına genişlemesidir: değerlendirme kümesindeki her üretimde
`findUnmaskedContent()` (bu paketin `research/guard.ts` fonksiyonu, M7.3)
çalıştırılır — çıktıda kimlik deseni bulunursa o adaptör **kullanıma
alınmaz**, ne kadar akıcı yazsa da.

### Geri alma

LoRA'nın en büyük avantajı burada: adaptör, taban modelin ağırlıklarını
**değiştirmez**, ayrı küçük bir dosyadır (§0, madde 2). Geri alma =
adaptörü yüklemeyi bırakmak; taban model + üslup profili + few-shot (A8/A9)
her zaman çalışır durumda kalır (`PROTOCOL.md` G7'nin bu paketteki
yansıması: fine-tuning'in yokluğu da hiçbir özelliği kapatmaz). Kötü bir
adaptör silinir, yeniden eğitilir; taban sistem hiçbir noktada bozulmaz.
