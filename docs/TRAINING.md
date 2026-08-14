# TRAINING — LoRA / QLoRA eğitimi

Plan M9. `CAPABILITIES.md` B2 — bölünemez yerleşik bellek (taban model +
gradyanlar + optimizasyon durumu aynı anda bellekte); bu yüzden eğitim
**yalnız masaüstünde**, isteğe bağlı bir kalite yükseltmesi olarak
tanımlanır. Hiçbir özellik buna bağlı değildir (`PROTOCOL.md` G7): üslup
öğrenme M8 (A8) ile telefonda, fine-tuning'siz zaten çalışır.

> **Doğrulama notu** (bkz. `docs/MODEL.md` başı ile aynı kısıt). Bu ortamda
> `huggingface.co` ve genel ağ egress'i kapalı; aşağıdaki sayılar LoRA/QLoRA
> literatüründe **yaygın olarak bilinen, tekrarlanan** yaklaşık değerlerdir
> (Dettmers ve ark., QLoRA; PEFT/Unsloth dokümantasyon kalıpları), belirli bir
> model kartından **birebir teyit edilmemiştir**. Her bölüm `doğrulandı` /
> `yaygın bilinen tahmin` / `teyit gerek` diye işaretlidir. Gerçek eğitimden
> önce §6 ve §7'deki sayılar **küçük bir deneme koşusuyla doğrulanmalıdır** —
> bu belge bir başlangıç noktasıdır, kesin bir mühendislik tablosu değil.

---

## 1. Fine-tuning ile başlanmıyor (M8.6)

Üslup öğrenme sırası `CAPABILITIES.md` A8 ve plan `M8`'de tanımlıdır:
**(a) yapı/iskelet çıkarma → (b) üslup profili JSON → (c) few-shot.**
Fine-tuning bilinçli olarak en sona bırakıldı. Gerekçe (`docs/MODEL.md` §4 ile
birebir aynı karar, iki belgede de bağlayıcı olsun diye tekrarlanır):

1. **Veri yok.** LoRA için anlamlı bir alt sınır birkaç yüz örnektir.
   Kullanıcının eski dilekçeleri bu sayıya ulaşana kadar few-shot (M8.5) zaten
   daha iyi sonuç verir.
2. **Geri alınamaz.** Few-shot'ta bağlamı değiştirirsiniz, biter. Fine-tune'da
   ağırlıkları değiştirirsiniz; kötü çıkarsa yeniden eğitmek gerekir.
3. **Telefonda eğitilemez.** Eğitim `CAPABILITIES.md` B2 — bölünemez yerleşik
   bellek (taban model + gradyanlar + optimizasyon durumu aynı anda bellekte).
   Fine-tuning'e bel bağlamak telefon-öncelikli kuralı (`CAPABILITIES.md`
   "Tek kural") çiğnemek olurdu.
4. **Ölçemeden ayarlanmaz.** Üslup profili + few-shot çalışırken çıktı kalitesi
   ölçülür; ancak o ölçüm varsa fine-tuning'in bir şey kattığı söylenebilir.

**Sonuç:** `packages/hukuk-ai` üslup öğrenmeyi tamamen M8 (A8) ile, telefonda,
fine-tuning'siz sağlar. Fine-tuning yalnız masaüstünde, isteğe bağlı bir kalite
yükseltmesidir — hiçbir özellik buna bağlı değildir.

---

## 2. Veri formatı — JSONL şeması (M9.1)

Her satır bağımsız bir eğitim kaydıdır (talimat ayarlı biçim — LoRA/QLoRA'nın
çoğu araç zincirinde beklediği biçim, `doğrulandı`: bu, PEFT/TRL ekosisteminde
yaygın kabul gören genel bir kalıptır).

```jsonc
{
  "documentType": "istinaf dilekçesi",     // write/draft.ts DocumentOutline.documentType ile aynı sözlük
  "sectionHeading": "2.1. Zamanaşımı",     // hangi bölüm — write/structure.ts HeadingInfo.text
  "instruction": "Aşağıdaki olgulara dayanarak, verilen üslupta bu bölümü yaz.",
  "facts": ["f1: sözleşme 12.03.2020 tarihli", "f2: son ödeme 03.2021"],
  "styleHints": {                          // extractStyleProfile()'ın küçük bir özeti, TAM profil değil
    "avgSentenceWords": 18,
    "stockPhrases": ["yukarıda açıklanan nedenlerle"],
    "citationStyle": "TBK m. N"
  },
  "output": "Taraflar arasındaki sözleşme…"  // HEDEF metin — eğitimin öğreneceği çıktı
}
```

**Alan adları kasıtlı olarak `write/draft.ts`'teki (`OutlineSection`,
`SectionGenerationInput`) ve `write/style.ts`'teki (`StyleProfile`)
alanlarla hizalıdır** — eğitim verisi üretimi ile çalışma zamanı `SectionBackend`
çağrısı aynı şekli paylaşsın diye. Bu paket JSONL'i **üretmez, okumaz**;
biçim yalnız belgeleme amaçlıdır (eğitim boru hattı bu paketin dışındadır, B2).

---

## 3. Veri hazırlama (M9.2)

**Değişmez kural (SPEC S3'ün eğitime yansıması):** Ham müvekkil verisi eğitime
**hiçbir biçimde girmez.** Bu iki farklı riski kapatır:

1. **Doğrudan sızıntı** — TCKN/IBAN/ad gibi veriler eğitim setinde düz metin
   olarak durursa, model bunları ezberleyip başka bir kullanıcıya sunabilir.
2. **Token'ı ezberleme riski** — `[KISI_1]` gibi maske token'larını **olduğu
   gibi** hedef metne koymak da yanlıştır: model gerçek yazıda da köşeli
   parantezli token üretmeyi öğrenir, bu okunaksızdır ve `SPEC.md` §3.2'deki
   kaçış mekanizmasıyla karışabilir.

**Doğru boru hattı:**

```
eski dilekçe (ham)
   │  mask()  — cihazda, SPEC §3-6
   ▼
maskeli metin + MaskTable (bellek içi)
   │  SENTETİK YER DEĞİŞTİRME — token'lar GERÇEKÇİ ama SAHTE isimlerle değiştirilir
   │  (sabit bir sahte-ad havuzundan: "Ayşe Demir", "Kenan Sarı" vb.; TCKN/IBAN
   │  için deterministik ama geçersiz-doğrulamalı sahte değerler)
   ▼
eğitim kaydı (output alanı) — okunabilir, akıcı, ama GERÇEK KİMLİK YOK
```

`MaskTable`, sentetik değiştirme yapıldıktan sonra **atılır** — eğitim
boru hattı hiçbir noktada gerçek ↔ maske eşlemesini diske yazmaz (S2/S3 ile
aynı disiplin, eğitim bağlamına taşınmış hâli).

**Neden token değil sentetik isim:** Amaç modelin akıcı Türkçe hukuk metni
üretmesini öğretmek, "köşeli parantez doldur" davranışı değil. Üretim
zamanında gerçek isimler zaten `unmask()` ile veya kullanıcının kendi
düzenlemesiyle metne döner — bu, eğitilen modelin işi değildir.

---

## 4. Örnek sayısı (M9.3) — `yaygın bilinen tahmin`

Bu bir **üslup adaptasyonu**dur, **bilgi enjeksiyonu** değildir — model yeni
hukuki bilgi öğrenmiyor (o bilgi zaten taban modelde ya da A6 araştırma
katmanında), yalnızca YAZIM biçimini öğreniyor. Üslup adaptasyonu, bilgi
enjeksiyonuna göre çok daha az örnekle doygunlaşır.

| Eşik | Örnek sayısı | Not |
|---|---|---|
| Alt sınır (anlamlı sinyal başlar) | ~50–100 | Bunun altında few-shot (M8.5) genelde daha iyi sonuç verir — fine-tuning'in bir şey kattığını gösteremezsiniz |
| Önerilen aralık | 300–1.000 | Tek avukatın/büronun tipik dilekçe arşivi bu aralığa düşer |
| Doygunluk noktası | ~1.500–3.000 | Bunun ötesinde ek örnek marjinal getiri sağlar; veri çeşitliliği (farklı dava türleri) sayıdan daha değerli hâle gelir |

**Pratik sonuç:** Bir büronun 200–400 eski dilekçesi varsa, önce (M9.5
tablosundaki) QLoRA ile denenir; alt sınırın altındaysa `docs/MODEL.md` §4
gerekçesiyle few-shot'ta kalınır.

---

## 5. Hiperparametreler (M9.4) — `yaygın bilinen tahmin`

| Parametre | Önerilen değer | Gerekçe |
|---|---|---|
| `rank` (r) | 8–16 (üslup-only), 32–64 (daha güçlü adaptasyon) | Düşük rank üslup gibi "yüzeysel" görevler için yeterlidir; yüksek rank overfitting riskini ve VRAM'i artırır |
| `alpha` | genelde `2 × rank` | Yaygın kural-of-thumb; etkin öğrenme oranını ranktan bağımsızlaştırır |
| `dropout` | 0,05–0,10 | Küçük veri setinde (§4) overfitting'e karşı |
| `learning rate` | 1e-4 – 2e-4 | LoRA'da tam ince ayardan (`1e-5` mertebesi) tipik olarak daha yüksek — yalnız adaptör ağırlıkları güncellenir |
| `epoch` | 2–4 | Küçük veri setinde 4'ün üzeri genelde ezberlemeye (kalıp ifadelerin birebir tekrarına) kayar |
| `batch size` (fiili) | 1–4 | VRAM sınırlı (bkz. §6); gerçek örnekleme boyutu bu |
| `gradient accumulation` | 4–16 | Fiili 16–32 etkin batch'e ulaşmak için — **model ayak izini küçültmez**, yalnız yığın boyutunu simüle eder (`CAPABILITIES.md` B2'nin dediği tam olarak bu: gradyan biriktirme bölünemez belleği aşmanın yolu değildir) |

**Değerlendirme sinyali (M9.8 ile bağlı):** Eğitim kaybı (loss) düşerken
doğrulama setinde stil-özellik benzerliği (bkz. §8) düşmeye başlarsa,
overfitting işaretidir — epoch sayısı azaltılır.

---

## 6. Donanım gereksinimi — VRAM tablosu (M9.5) — `yaygın bilinen tahmin`

Kaba yaklaşıklık: taban model ağırlığı (fp16 ≈ 2 bayt/parametre, 4-bit ≈
0,5–0,6 bayt/parametre) + LoRA adaptör ağırlıkları (küçük, birkaç yüz MB) +
optimizer durumu (yalnız adaptör parametreleri için, taban donmuş) + aktivasyon
belleği (sıra uzunluğuna bağlı, kabaca +2–4 GB).

| Model | LoRA (fp16 taban) | QLoRA (4-bit taban) | Tek tüketici GPU'ya sığar mı |
|---|---|---|---|
| 7 B | ~16–20 GB | ~8–10 GB | QLoRA: **evet** (12–16 GB kart) |
| 9 B | ~20–24 GB | ~10–13 GB | QLoRA: **evet** (16–24 GB kart) |
| 27 B | ~56–64 GB | ~16–20 GB | QLoRA: **sınırda** (24 GB kart, kısa bağlamla); LoRA: **hayır**, çoklu GPU gerekir |

**Referans noktası (`teyit gerek` ama sıkça atıf yapılır):** QLoRA'nın
orijinal çalışması 65 B sınıfı bir modelin tek 48 GB GPU'da eğitilebildiğini
gösterir — buradaki 27 B/20 GB satırı bu ölçekleme mantığıyla tutarlıdır ama
`packages/hukuk-ai`'de doğrulanmamıştır.

**Masaüstü tarafında karşılığı** (`CAPABILITIES.md` B2, `docs/MODEL.md` §3.3
Mizan-27B): 27 B QLoRA, Mizan'ın kendisini masaüstünde çalıştırmak için zaten
gereken donanım sınıfına (≥ 24 GB VRAM) yakındır — eğitim ayrı bir donanım
alımı gerektirmeyebilir, ama eğitim + çıkarımın **aynı anda** çalışması
istenmez (ikisi de belleği doldurur).

---

## 7. Tahminî süre ve maliyet (M9.6) — `teyit gerek`

Kesin dakika/dolar sayısı **verilmiyor** — donanım, kütüphane sürümü ve kira
fiyatları zamanla değişir ve bu ortamda doğrulanamıyor (bkz. dosya başı not).
Bunun yerine **formül** verilir; kullanıcı kendi ölçümüyle doldurur.

```
tahminî_süre = (örnek_sayısı × epoch_sayısı × örnek_başına_saniye) / paralellik

örnek_başına_saniye: küçük bir deneme koşusuyla (50 örnek, 1 epoch) ölçülür —
bu paketin CAPABILITIES.md §C.0 kalibrasyon felsefesiyle aynı ilke: tahmin
etmek yerine ölç.
```

| Ortam | Tipik profil | Maliyet hesabı |
|---|---|---|
| **Yerel GPU** | Sabit donanım, elektrik dışında marjinal maliyet yok | Yalnız süre önemli; gece boyu koşturulabilir |
| **Kiralık GPU** (bulut) | Saat başı ücretlendirme | `tahminî_süre_saat × saatlik_kira_ücreti` — ücreti **güncel fiyat listesinden** alın, bu belgeye sabit rakam yazılmaz |

**Pratik tavsiye:** Önce §4'teki alt sınıra yakın küçük bir denemeyle (50–100
örnek, 1 epoch) hem süre hem kalite ölçülür; tam koşuya o ölçümle karar
verilir.

---

## 8. Adım adım çalıştırma yönergesi (M9.7) — `örnek iskelet, sürümler teyit gerek`

Aşağıdaki komutlar **iskelettir** — kütüphane sürüm numaraları bu ortamda
teyit edilemedi (ağ egress kapalı). Çalıştırmadan önce sürümleri kontrol edin.

```bash
# 1. Ortam (masaüstünde, PEFT/QLoRA destekli bir yığın)
pip install transformers peft bitsandbytes accelerate trl

# 2. Veri — §2/§3'teki JSONL, örn. dilekceler.jsonl
#    (Bu paket veriyi ÜRETMEZ; ana uygulamanın eski dilekçe arşivinden,
#    §3'teki boru hattıyla, bu paketin DIŞINDA hazırlanır.)

# 3. QLoRA eğitimi (örnek, TRL SFTTrainer kalıbı)
python train_lora.py \
  --model_name_or_path <taban-model> \
  --dataset_path dilekceler.jsonl \
  --load_in_4bit \
  --lora_r 16 --lora_alpha 32 --lora_dropout 0.05 \
  --learning_rate 2e-4 \
  --num_train_epochs 3 \
  --per_device_train_batch_size 2 \
  --gradient_accumulation_steps 8 \
  --output_dir ./adapters/uslup-v1

# 4. Adaptörü test et (taban model DEĞİŞMEDİ — yalnız adaptör yüklendi)
python generate.py --base <taban-model> --adapter ./adapters/uslup-v1 \
  --prompt "<write/draft.ts SectionGenerationInput biçiminde bir istem>"
```

**Adım 4 kritik:** Adaptör taban ağırlıkları değiştirmez, ayrı bir dosyadır
(§9'daki geri alma bunun üzerine kurulu).

---

## 9. Değerlendirme (M9.8)

### 9.1 Kalite nasıl ölçülür

1. **Stil-özellik benzerliği (otomatik, bu paketle ölçülebilir).** Üretilen
   bölümler `extractStyleProfile()`'dan geçirilir; sonuç, orijinal arşivin
   birleşik profiliyle (`mergeStyleProfiles`) karşılaştırılır — cümle uzunluğu
   ortalaması, kalıp ifade kullanım oranı, atıf biçimi tutarlılığı gibi
   alanlarda sapma ölçülür. Bu, `write/style.ts`'in zaten ürettiği JSON
   üzerinde çalışan basit bir fark hesabıdır, yeni kod gerektirmez.
2. **Kör tercih testi (insan).** Aynı girdi hem few-shot (M8.5) hem fine-tuned
   adaptörle üretilir; kullanıcı hangisini tercih ettiğini bilmeden seçer.
   Fine-tuning'in gerçekten bir şey kattığını gösteren TEK ölçüt budur —
   otomatik stil benzerliği yüksek olsa bile insan tercihi düşükse fine-tuning
   kazanç sağlamıyor demektir.
3. **Numaralandırma/atıf tutarlılığı (otomatik, bu paketle ölçülebilir).**
   `checkNumberingConsistency()` üretilen bölümlere karşı koşulur — fine-tuned
   model few-shot'tan daha az deterministik hata üretiyor mu diye.

### 9.2 Geri alma nasıl yapılır

LoRA adaptörü **taban model ağırlıklarını değiştirmez** — ayrı, küçük bir
dosyadır (§8 adım 3–4). Geri alma bu yüzden **anındadır ve risksizdir**:

- Adaptörü yüklemeyi bırakmak = taban modele + few-shot'a (M8) geri dönmek.
- Birden çok adaptör sürümü (`uslup-v1`, `uslup-v2`…) yan yana saklanabilir;
  kötü bir eğitim koşusu önceki sürüme dönmekle düzelir, yeniden eğitim
  gerektirmez.
- Hiçbir noktada taban model dosyası üzerine yazılmaz — bu, `docs/MODEL.md`
  §3'te seçilen taban modelin (Mizan-27B, masaüstü) bütünlüğünü korur.
