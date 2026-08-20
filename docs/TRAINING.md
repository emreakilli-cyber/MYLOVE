# TRAINING — LoRA/QLoRA eğitim rehberi

Plan M9. `CAPABILITIES.md` B2 — **bölünemez bellek**, yalnız masaüstünde
(veya kiralık GPU'da) çalışır; telefonla hiçbir ilgisi yoktur ve hiçbir
telefon özelliği buna bağlı değildir (PROTOCOL G7).

**Bu rehber bir tarif kitabıdır, bir yükümlülük değil.** M8.6'daki dört koşul
karşılanmadan (bkz. aşağı) hiç çalıştırılmaz; few-shot (M8.5) + üslup profili
(M8.3/M8.4) yeterliyken fine-tuning'e geçmek gerilemedir.

---

## Fine-tuning ile başlanmıyor (M8.6)

Karar ve tam gerekçesi `docs/MODEL.md` §4'te yazılıdır — burada yalnız özeti
tekrarlanır, tek kaynak `MODEL.md` kalsın diye:

1. **Veri yok.** LoRA için anlamlı alt sınır birkaç yüz örnektir; kullanıcının
   eski dilekçe sayısı oraya ulaşana kadar few-shot (M8.5) zaten daha iyi
   sonuç verir.
2. **Geri alınamaz.** Few-shot'ta bağlam değişir, biter. Fine-tune'da
   ağırlıklar değişir; kötü çıkarsa yeniden eğitmek gerekir.
3. **Telefonda eğitilemez.** Eğitim `CAPABILITIES.md` B2 — bölünemez bellek;
   fine-tuning'e bel bağlamak telefon-öncelikli kuralı çiğner.
4. **Ölçemeden ayarlanmaz.** Üslup profili + few-shot çalışırken çıktı
   kalitesi ölçülür; ancak o ölçüm varsa fine-tuning'in bir şey kattığı
   söylenebilir.

**Sıra:** (a) yapı/iskelet çıkarma (M8.2) → (b) üslup profili JSON (M8.3/M8.4)
→ (c) few-shot seçimi (M8.5) → *(fine-tuning, yalnız yukarıdaki dört koşul
karşılanırsa, en sona)*.

---

## 1. Veri formatı (M9.1)

JSONL — satır başına bir JSON nesnesi, sohbet biçimi. Kayıt granülerliği
**bölüm** düzeyindedir (belge değil) — çünkü çıkarım da `write/staged.ts`'te
bölüm bölüm çalışır (A13); eğitim ve çıkarım aynı birimde konuşmazsa öğrenilen
biçim, gerçek kullanım biçimiyle örtüşmez.

```jsonl
{"messages": [
  {"role": "system", "content": "Türkçe hukuk dilekçesi bölümü yaz. Üslup: ortalama cümle 18 kelime, numaralandırma: arabic."},
  {"role": "user", "content": "BÖLÜM: SONUÇ VE İSTEM\nOLGULAR:\n- Davalı [KURUM_1] ile [TARIH_1] tarihli sözleşme feshedildi\n- Gider avansı [KISI_1] tarafından yatırıldı"},
  {"role": "assistant", "content": "Yukarıda arz ve izah edilen nedenlerle, [KURUM_1] aleyhine açılan işbu davanın kabulü ile..."}
]}
```

| Alan | Zorunlu | Açıklama |
|---|---|---|
| `messages[0]` (system) | evet | `write/staged.ts` `buildSectionPrompt`'un ÜSLUP satırıyla aynı biçim — eğitim ve çıkarım prompt'u tek kaynaktan üretilsin diye |
| `messages[1]` (user) | evet | `SectionSpec`'in birebir izdüşümü: `BÖLÜM:` + `OLGULAR:` satırları |
| `messages[2]` (assistant) | evet | Hedef çıktı — **her zaman maskelenmiş** metin (bkz. §2) |

---

## 2. Veri hazırlama (M9.2)

```
eski dilekçeler (ham, diskte)
   │
   ▼  mask()  ── SPEC §3, aynı fonksiyon write/styleProfile.ts'in kullandığı
maskelenmiş belge
   │
   ▼  extractSkeleton()  ── M8.2, aynı fonksiyon
bölüm sınırları
   │
   ▼  her bölüm için: olgu satırlarını DETERMİNİSTİK olarak geri türet
      (başlık + bölümdeki [TIP_N] token'larının listesi → "OLGULAR:" satırları)
   │
   ▼
JSONL kaydı (yalnız maskelenmiş metin — §1 şeması)
```

**Değişmez kural:** pipeline'ın HİÇBİR adımı ham metni diske yazmaz. Girdi
diskten okunur, `mask()` bellekte çalışır, yalnız maskelenmiş JSONL diske
yazılır — tıpkı `write/styleProfile.ts`'teki S7 kararında olduğu gibi (bkz.
`docs/QUESTIONS.md`). "OLGULAR" satırları bölümün gerçek metnindeki maske
token'larından türetilir (`[KURUM_1] ile ... feshedildi` gibi bir cümle
görülürse `- Davalı [KURUM_1] ile sözleşme feshedildi` satırı üretilir); bu
adım model kullanmaz, kural tabanlıdır — eğitim verisi kendisi de A3'ün
"model olmadan da çalışır" ilkesine uyar.

Doğrulama: `write/write.test.ts`'teki "değişmez kural" testiyle aynı desende,
hazırlanan JSONL dosyası TCKN/IBAN/telefon deseni içermediği testle
doğrulanmadan eğitime sokulmaz.

---

## 3. Örnek sayısı (M9.3)

| Aralık | Değerlendirme |
|---|---|
| < 100 bölüm | **Önerilmez.** Few-shot (M8.5) bu ölçekte daha iyi ve geri alınabilir sonuç verir — M8.6 kararı |
| 100–500 | Sınırda; yalnız tek, dar bir dilekçe türü (ör. yalnız icra itirazı) için denenebilir |
| 500–2.000 | **Önerilen aralık.** Dar bir üslup transferi görevi (biçim/ton, yeni hukuki bilgi değil) için tipik doygunluk bandı |
| > 2.000 | Ek fayda azalır; veri kalitesi (tutarlı, tek avukat/büro üslubu) miktardan daha belirleyici hâle gelir |

*(tahmin — bu proje için özel ölçüm yok; dar-görev LoRA literatüründeki genel
kabul edilen aralıklara dayanır. `MODEL.md`'deki `doğrulandı`/`tahmin`
etiketleme kuralına uyularak burada da `tahmin` işaretlenmiştir.)*

---

## 4. Hiperparametreler (M9.4)

| Parametre | Önerilen | Gerekçe |
|---|---|---|
| rank (`r`) | 16 | Küçük, dar bir üslup transferi görevi; 8–32 aralığının ortası, aşırı öğrenme riskini düşük tutar |
| alpha | 32 (`2×r`) | Yaygın kural — etkin öğrenme oranını rank'tan bağımsızlaştırır |
| dropout | 0.05 | 500–2.000 örneklik küçük veri setinde ezberlemeyi (overfitting) frenler |
| öğrenme oranı | 1e-4 – 2e-4 | LoRA, tam ince ayardan yüksek öğrenme oranı ister (yalnız küçük adaptör matrisleri güncelleniyor) |
| epoch | 2–3 | Küçük veri setinde 3'ten fazla epoch tipik olarak ezberlemeye döner |
| per-device batch | 1–4 | Bölüm başına ≤ 2.000 token (A13 bütçesi) — sıra uzunluğu zaten sınırlı, büyük batch VRAM'i zorlar |
| gradyan biriktirme | etkin batch ~16–32'ye çıkacak kadar (ör. batch 4 × biriktirme 4–8) | Küçük GPU'da büyük etkin batch'in stabilite faydasını korur |
| hedef modüller | `q_proj`, `k_proj`, `v_proj`, `o_proj` (dikkat katmanları) | Standart LoRA hedefi; MLP katmanlarını da eklemek küçük veri setinde ezberlemeyi artırır |

---

## 5. Donanım gereksinimi (M9.5)

QLoRA (4-bit temel model + LoRA adaptörü), sıra uzunluğu ~2.000 token
(A13 bölüm bütçesiyle aynı), batch 1 varsayımıyla:

| Model | Parametre | Yöntem | Asgari VRAM | Önerilen VRAM | Uygun kart |
|---|---|---|---|---|---|
| Telefon üretim modeli | 2–4 B | QLoRA | ~4–6 GB *(tahmin, 7B'nin oranlı küçültülmesi)* | 8–12 GB | RTX 3060 12GB, RTX 4060 Ti 16GB |
| Turkish-Gemma (yedek) | 7–9 B | QLoRA | ~12 GB | 16–24 GB | RTX 4090 24GB |
| Mizan-27B (masaüstü) | 27 B | QLoRA | ~40–44 GB *(30B/32B verisinden enterpolasyon)* | 48 GB | RTX A6000 48GB, A100/H100 80GB |
| Mizan-27B (masaüstü) | 27 B | LoRA (16-bit temel) | ~55–65 GB *(tahmin)* | 80 GB | A100/H100 80GB |

**Kaynak:** 7B/13B/30B QLoRA VRAM rakamları [LLM Fine-Tuning Hardware
Requirements](https://llmhardware.io/guides/llm-fine-tuning-hardware-requirements)
ve [Spheron GPU VRAM Requirements
2026](https://www.spheron.network/blog/gpu-vram-requirements-fine-tune-llm-2026/)'dan;
2–4B ve 27B satırları bu tablodan **enterpolasyon/ekstrapolasyondur**, doğrudan
ölçülmedi — `tahmin` işaretlidir. Gerçek çalıştırmadan önce küçük bir deneme
adımıyla (ör. 50 kayıt, 1 epoch) doğrulanmalı.

---

## 6. Tahminî süre ve maliyet (M9.6)

| Senaryo | Süre *(tahmin)* | Maliyet |
|---|---|---|
| Yerel GPU (kullanıcının kendi kartı) | 2–6 saat (2–4B/7–9B, 500–2.000 bölüm, 2–3 epoch) | Yalnız elektrik — donanım zaten var, ek maliyet ihmal edilebilir |
| Kiralık GPU — telefon modeli (RTX 4090, ~$0,34–0,69/sa) | 2–6 saat | **~$1–4** |
| Kiralık GPU — Mizan-27B (A100/A6000, ~$1,07–1,99/sa) | 4–10 saat *(daha büyük model, aynı adım sayısında adım başı süre artar)* | **~$5–20** |
| Kiralık GPU — Mizan-27B, H100 (~$1,49–2,99/sa) | 3–7 saat | **~$5–20** |

**Kaynak:** GPU kiralama saatlik ücretleri [H100 Rental Prices Compared —
IntuitionLabs](https://intuitionlabs.ai/articles/h100-rental-prices-cloud-comparison),
[GPU Cloud Pricing Comparison 2026 —
Spheron](https://www.spheron.network/blog/gpu-cloud-pricing-comparison-2026/)
kaynaklarından (2026, RunPod/Vast.ai/Lambda karışımı). Fiyatlar haftalık
değişir; kesin karardan önce güncel oran kontrol edilmeli. Süre tahminleri
ölçülmedi, `tahmin` işaretlidir.

---

## 7. Adım adım çalıştırma yönergesi (M9.7)

Araç seti: `transformers` + `peft` + `bitsandbytes` (4-bit yükleme) + `trl`
(`SFTTrainer`) + `accelerate`. Bunların hiçbiri `packages/hukuk-ai`'nin
bağımlılığı DEĞİLDİR (M0.3 sıfır bağımlılık) — bu araçlar yalnız masaüstünde/
kiralık makinede, paketin dışında çalışan ayrı bir eğitim betiğinde kullanılır.

1. **Ortam.** `pip install transformers peft bitsandbytes trl accelerate`
2. **Veri.** §2'deki pipeline'ı çalıştır → `train.jsonl` (%90) / `val.jsonl`
   (%10, rastgele bölünmüş, aynı belgeden iki bölüm aynı bölmede kalmalı —
   sızıntıyı önlemek için belge bazında böl, bölüm bazında değil).
3. **Temel modeli 4-bit yükle** (`BitsAndBytesConfig(load_in_4bit=True,
   bnb_4bit_quant_type="nf4")`).
4. **LoRA uygula** (`peft.LoraConfig`, §4'teki değerlerle;
   `target_modules` = §4'teki dikkat katmanları).
5. **Eğit** (`trl.SFTTrainer`, `train.jsonl`/`val.jsonl`, §4'teki epoch/batch/
   gradyan biriktirme; her epoch sonunda `val.jsonl` kaybı loglanır — artmaya
   başlarsa ezberleme başlamıştır, erken durdur).
6. **Adaptörü kaydet** (`model.save_pretrained("hukuk-ai-style-lora-vN")`) —
   **base model'e merge ETME.** Adaptör ayrı dosya kalmalı ki §8'deki geri
   alma bedelsiz olsun.
7. **Değerlendir** (§8).
8. **Telefon dağıtımı için** (yalnız telefon-boyutlu modelde anlamlı):
   adaptörü merge et (`merge_and_unload()`) → GGUF'a dönüştür (llama.cpp
   `convert_hf_to_gguf.py`) → `Q4_K_M` kuantize et (`MODEL.md` §3.2 ile aynı
   format).

---

## 8. Değerlendirme (M9.8)

**Otomatik proxy ölçüm** (insan incelemesinin YERİNE geçmez, ön elemedir):

1. Tutulan (held-out) `val.jsonl` bölümlerinde model üretimi çalıştırılır.
2. `write/staged.ts`'teki `checkConsistency` **aynen** üretilen çıktıya
   uygulanır — numaralandırma/atıf/terim tutarsızlığı varsa ince ayar
   çıktı kalitesini düşürmüş demektir, hiperparametreler gözden geçirilir.
3. Üretilen metin ile gerçek (maskelenmiş) hedef arasında `write/fewShot.ts`
   `selectFewShot`'taki Jaccard benzerliğiyle aynı ölçüt kullanılır — düşük
   benzerlik, modelin üslubu değil içeriği ezberlediğine işaret edebilir
   (üslup transferinde beklenen ORTA benzerlik; %100 benzerlik ezber
   şüphesidir).

**Zorunlu insan incelemesi:** otomatik ölçüm hiçbir zaman tek başına
yeterli değildir — CLAUDE.md'nin "hukuki süre hesabı bilgilendirme
amaçlıdır, kullanıcının teyidi esastır" duruşuyla aynı ilke: ince ayarlı
modelin ürettiği HİÇBİR metin, bir avukatın onayından geçmeden dosyaya
girmez. Bu, `write/*`'ın zaten insan onaylı bir akış (M6 onay ekranı, M8.7
bölüm bölüm onay) olmasıyla tutarlıdır.

**Geri alma:** LoRA adaptörü temel model ağırlıklarını hiç DEĞİŞTİRMEZ —
ayrı bir dosyadır (§7 madde 6). Kötü bir sürüm tespit edilirse adaptör dosyası
bir önceki sürüm numarasına (`hukuk-ai-style-lora-v(N-1)`) geri döndürülür;
yeniden eğitim ya da yeniden indirme gerekmez. Bu, M8.6'nın "geri alınamaz"
gerekçesinin (fine-tuning'in few-shot'a göre dezavantajı) LoRA'ya özgü kısmi
çözümüdür — tam çözüm değildir, çünkü veri toplama ve eğitim süresi hâlâ
few-shot'tan daha maliyetlidir.
