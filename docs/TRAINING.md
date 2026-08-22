# TRAINING — LoRA/QLoRA eğitimi (ileri aşama)

> **Durum:** plan M9 tamamlandı. Bu belge iki farklı güvenilirlikte bilgi
> taşır: (1) **karar** — fine-tuning ile başlanmaması, `docs/MODEL.md` §4 ile
> aynı gerekçeye dayanır, bağlayıcıdır; (2) **yönerge** — aşağıdaki
> hiperparametre/donanım/süre değerleri, bu ortamda `huggingface.co` ve genel
> ağ erişimi kapalı olduğu için **doğrudan doğrulanamadı** (`docs/MODEL.md`
> başındaki doğrulama notuyla aynı kısıt). Değerler LoRA/QLoRA literatüründeki
> yaygın pratiklere dayanır ve `tahmin` olarak işaretlidir; koşmadan önce
> gerçek veri/donanımla küçük bir pilot turla teyit edilmelidir. **Hiçbir
> `tahmin` değeri M8.6'daki "fine-tuning ile başlanmıyor" kararına dayanak
> yapılmadı** — o karar veri yetersizliğine ve geri alınamazlığa dayanıyor,
> bu belgedeki sayılara değil.

## Karar: Fine-tuning ile başlanmıyor

Üslup öğrenme sırası (`docs/CAPABILITIES.md` A8, plan M8):

**(a) yapı/iskelet çıkarma → (b) üslup profili JSON → (c) few-shot seçimi.**

Fine-tuning (LoRA/QLoRA) bu sıranın **dışında** ve en sonda tutulur. Ayrıntılı
gerekçe `docs/MODEL.md` §4'te dört maddeyle yazılıdır (veri yetersizliği,
geri alınamazlık, telefonda eğitilemezlik — `CAPABILITIES.md` B2, ölçüm
olmadan ayarlanamazlık). Bu belge o gerekçeyi tekrar etmez; tek satırda özeti:

> Few-shot + üslup profili, veri azken zaten fine-tuning'den daha iyi sonuç
> verir; fine-tuning'in bir şey kattığı ancak few-shot'un tavanı ölçülünce
> söylenebilir. O ölçüm yok — dolayısıyla karar yok.

## Bu kararın kod karşılığı

`packages/hukuk-ai/src/write/` hiçbir eğitim/fine-tuning kodu içermez ve
içermeyecektir — yazma katmanı (M8) yalnız çıkarım zamanı (inference-time)
tekniklerle çalışır: `extractStructure` (deterministik), `StyleProfileBuilder`
(deterministik istatistik), `selectFewShot` (deterministik benzerlik). Model
gerektiren tek yer `generate.ts`'teki pluggable `OutlineBackend` /
`SectionBackend` / `ConsistencyBackend` arayüzleridir — bunlar da **var olan**
bir modeli çağırır, yeni ağırlık üretmez.

## M9.1 — Veri formatı: JSONL şeması

Bir satır = bir eğitim örneği. Instruction-tuning biçimi, `write/generate.ts`
`SectionBackend.writeSection` çağrısıyla aynı üçlüye (heading + notlar →
metin) karşılık gelir; eğitim verisi de aynı arayüzü besleyecek biçimde
üretilir.

| Alan | Tip | Zorunlu | Açıklama |
|---|---|---|---|
| `instruction` | `string` | evet | Görev tarifi, sabit kalıptan üretilir (ör. "Aşağıdaki olgulara dayanarak '{heading}' bölümünü yaz.") |
| `input` | `string` | evet | **Maskelenmiş** bağlam: bölüm notları + varsa few-shot alıntıları |
| `output` | `string` | evet | **Maskelenmiş** hedef metin — o bölümün gerçek (geçmiş) yazımı |
| `heading` | `string` | evet | Bölüm başlığı (`write/structure.ts` `DocumentStructure.headings`'ten) |
| `source_document_id` | `string` | evet | Hangi geçmiş dilekçeden geldiği — iz sürülebilirlik için, kişi kimliği DEĞİL |
| `mask_table_hash` | `string` | evet | O belgenin maskeleme tablosu özeti (`MaskTable.digest()`) — denetim izi |
| `numbering_style` | `NumberingStyle` | hayır | `extractStructure` çıktısı; üslup tutarlılığı için bağlam |

**Örnek kayıt:**

```json
{"instruction":"Aşağıdaki olgulara dayanarak 'SONUÇ VE İSTEM' bölümünü yaz.","input":"Olgular: [KISI_1] ile [KURUM_1] arasındaki sözleşme [KISI_1] tarafından ihlal edildi. Few-shot: Yukarıda arz ve izah edilen nedenlerle...","output":"Yukarıda açıklanan nedenlerle davanın kabulüne, yargılama giderleri ile vekâlet ücretinin davalı [KURUM_1] üzerinde bırakılmasına karar verilmesini saygılarımla arz ve talep ederim.","heading":"SONUÇ VE İSTEM","source_document_id":"dilekce-2023-0412","mask_table_hash":"sha256:3f9a...","numbering_style":"arabic"}
```

`instruction`/`input`/`output` alanlarının **hepsi maskelenmiş** olmak
zorundadır — bkz. M9.2. `mask_table_hash` asıl tabloyu taşımaz, yalnız
`digest()` özetidir (SPEC S2 / PROTOCOL G1 ile aynı kırmızı çizgi).

## M9.2 — Veri hazırlama: ham veri eğitime asla girmez

Boru hattı (pipeline), var olan `mask()`/`MaskGuard` sözleşmesini eğitim
verisi üretimine de uygular — yeni bir güvenlik modeli icat edilmez, M7.2'nin
aynısı burada da zorunlu kapıdır:

1. **Kaynak:** `StyleProfileBuilder`'a beslenen aynı geçmiş dilekçe korpusu.
2. **Maskele.** Her belge `mask()`'tan geçer (aynı `MaskTable` kuralları).
   Bölüm metinleri `extractStructure` ile ayrılır; her bölüm ayrı bir kayıt
   olur.
3. **Zorlayıcı kapı.** Yazılacak her JSONL satırı diske gitmeden önce
   `assertMasked(instruction + input + output)` çağrılır — M7.2'deki
   `MaskGuard` **burada da** çalışır, yalnız hedefi ağ değil eğitim
   dosyasıdır. Kural aynı: maskelenmemiş kimlik verisi taşıyan satır
   **yazılmaz**, atlanır ve sebebiyle birlikte bir hata günlüğüne düşer.
4. **"Yaz sonra sil" değil, "hiç yazma".** Ham metin hiçbir ara adımda geçici
   dosyaya, önbelleğe veya günlüğe yazılmaz — yalnız bellekte, maskeleme
   adımına kadar yaşar (üst düzey talimattaki DEĞİŞMEZ KURAL'ın bu boru
   hattındaki karşılığı).
5. **Böl.** Eğitim/doğrulama ayrımı **belge düzeyinde** yapılır (aynı
   dilekçenin farklı bölümleri iki kümeye dağılmaz) — aksi hâlde model
   üslubu ezberlemek yerine gerçekten öğrenip öğrenmediği ölçülemez.

## M9.3 — Örnek sayısı

| Eşik | Örnek sayısı | Not |
|---|---|---|
| Alt sınır (anlamlı LoRA) | **~200–300** | *(tahmin — sektör pratiği)* Bunun altında dar üslup uyarlaması bile gürültülü |
| Önerilen aralık | **~500–2.000** | Bir büronun birkaç yıllık dilekçe arşivi tipik olarak bu aralığa düşer (bölüm başına kayıt sayıldığında, belge sayısı değil) |
| Doygunluk noktası | **~3.000–5.000** üzeri | *(tahmin)* Dar bir üslup/terim dağarcığı için getiri azalır; büro üslubu zaten birkaç yüz örnekte yakalanır |

**Karşılaştırma çapası:** M8.6/`MODEL.md` §4'teki kararın gerekçesi de
buradan gelir — kullanıcının eski dilekçe sayısı bu alt sınıra ulaşana kadar
few-shot (M8.5) zaten daha az veriyle çalışır ve fine-tuning'i beklemeye
gerek bırakmaz.

## M9.4 — Hiperparametreler

*(tahmin — QLoRA literatüründeki yaygın başlangıç değerleri; koşmadan önce
küçük bir pilot turla doğrulanmalı)*

| Parametre | Önerilen değer | Gerekçe |
|---|---|---|
| `rank` (r) | 8–16 | Görev dar (üslup + terim tercihi, yeni bilgi değil) — yüksek rank gerekmez; düşük rank hem hızlı hem taşınabilir adapter üretir |
| `alpha` | 2×r (16–32) | Yaygın kural-of-thumb; etkin öğrenme oranını rank'tan bağımsızlaştırır |
| `dropout` | 0.05 | Küçük veri setinde ezberlemeyi (overfitting) frenler |
| Öğrenme oranı | 1e-4 – 2e-4 | QLoRA'da tam ince ayara göre daha yüksek lr tipik; adapter ağırlıkları küçük |
| Epoch | 3–5 | Küçük veri setinde daha fazlası ezberlemeye kayar; doğrulama kaybı (validation loss) yükselmeye başlarsa erken durdurulur |
| Batch (gerçek) | 4–8 | VRAM sınırlı; §M9.5 ile birlikte okunur |
| Gradyan biriktirme | 4–8 adım | Etkin batch'i (16–64) gerçek belleği aşmadan büyütür — **model ayak izini küçültmez**, yalnız yığın boyutunu (`CAPABILITIES.md` B2 ile aynı sınır) |

## M9.5 — Donanım gereksinimi (VRAM)

*(tahmin — taban model boyutuna göre kaba hesap: ağırlık + adapter + optimizör
durumu + aktivasyon; `MODEL.md` §2.1'deki Q4 boyutlarıyla tutarlı)*

| Taban model | LoRA (bf16 taban) | QLoRA (4-bit taban) |
|---|---|---|
| 7 B sınıfı | ~16–18 GB | ~6–8 GB |
| 9 B sınıfı (Turkish-Gemma-9b) | ~20–22 GB | ~8–10 GB |
| 27 B sınıfı (Mizan-27B) | ~60–65 GB (çok GPU) | ~16–20 GB |

**Telefonda hiçbiri çalışmaz** — bu tablonun en küçük satırı bile
`CAPABILITIES.md` §0'daki 1,2 GB bütçenin 5 katından fazladır; B2'nin
gerekçesi (bölünemez yerleşik bellek) burada da geçerli. Eğitim yalnız
masaüstünde/kiralık GPU'da yapılır.

## M9.6 — Tahminî süre ve maliyet

*(tahmin — 1.000 örnek, 3 epoch, QLoRA varsayımıyla kaba mertebe; gerçek
sayı veri uzunluğuna ve donanıma göre değişir)*

| Ortam | Donanım örneği | Tahminî süre | Tahminî maliyet |
|---|---|---|---|
| Yerel GPU | 24 GB tüketici kartı (ör. RTX 4090 sınıfı) | 9 B QLoRA: ~2–4 saat | Elektrik dışında ek maliyet yok |
| Yerel GPU | 24 GB tüketici kartı | 27 B QLoRA: **sığmayabilir** — bkz. §M9.5 sütun 3, çok GPU gerekebilir | — |
| Kiralık GPU | Bulut sağlayıcı, 24 GB sınıfı örnek | 9 B QLoRA: ~2–4 saat | *(tahmin, sağlayıcıya göre değişir)* düşük onlu $ mertebesi |
| Kiralık GPU | Bulut sağlayıcı, 40–80 GB sınıfı örnek | 27 B QLoRA: ~4–8 saat | *(tahmin)* orta onlu–yüz $ mertebesi |

Fiyatlar sağlayıcı/bölge/anlık arz-talebe göre değişir; bu belge belirli bir
sağlayıcı adı veya güncel fiyat vermez (doğrulanamaz, `MODEL.md` başındaki
kısıtla aynı sebep). Koşmadan önce seçilen sağlayıcının o anki saatlik
ücreti ile çarpılmalı.

## M9.7 — Adım adım çalıştırma yönergesi

Araç adı bilerek verilmiyor (PEFT/LoRA eğitimini destekleyen standart bir
araç — ör. Hugging Face `peft` + `bitsandbytes`, ya da eşdeğeri — seçimi
donanım ve taban modele göre yapılır); adımlar araçtan bağımsız sırayı
gösterir:

1. **Veri hazırla.** §M9.2'deki boru hattını çalıştır; çıktı yalnız
   maskelenmiş JSONL'dir (§M9.1 şeması). `assertMasked` her satırda geçmeden
   dosya diske yazılmaz.
2. **Böl.** JSONL'i belge kimliğine göre eğitim/doğrulama olarak ayır (ör.
   %90/%10), aynı `source_document_id`'nin iki kümede birden görünmediğini
   doğrula.
3. **Taban modeli indir/kuantize et.** `MODEL.md` §3.3'teki masaüstü adayı
   (Mizan-27B) ya da §3.4'teki yedek (Turkish-Gemma-9b); 4-bit kuantize
   (QLoRA) sürümünü seç.
4. **Adapter yapılandırmasını yaz.** §M9.4'teki `rank`/`alpha`/`dropout`
   değerleriyle bir LoRA config dosyası oluştur; hedef modüller genelde
   dikkat (attention) projeksiyon katmanlarıdır.
5. **Eğitimi başlat.** §M9.4'teki lr/epoch/batch/gradyan-biriktirme
   değerleriyle; doğrulama kaybını her epoch sonunda ölç, kaydet.
6. **Erken durdurma.** Doğrulama kaybı 2 ardışık epoch'ta düşmüyorsa dur —
   küçük veri setinde ezberleme (overfit) riski yüksektir (§M9.3).
7. **Adapter'ı ayrı sakla.** Taban model ağırlıkları **değişmez**; yalnız
   adapter (birkaç MB–birkaç yüz MB) çıktı olarak saklanır. Bu, §M9.8'deki
   geri almayı ucuzlatır.
8. **Değerlendir.** §M9.8.

## M9.8 — Değerlendirme ve geri alma

**Değerlendirme.** Eğitim sonrası kalite, few-shot temeline (M8.5) karşı
ölçülür — fine-tuning'in "bir şey kattığı" iddiası ancak bu karşılaştırma
varsa savunulabilir (M8.6'daki 4. gerekçeyle aynı ilke):

1. Aynı olgu/talep girdisiyle iki çıktı üretilir: (a) yalnız few-shot +
   üslup profili, (b) fine-tuned adapter + aynı few-shot.
2. Küçük bir insan değerlendirme rubriği: üslup uyumu (büronun kalıp
   ifadelerini kullanıyor mu — `StyleProfile.formulaicPhrases` ile
   karşılaştırılabilir), hukuki tutarlılık (uydurma atıf var mı —
   `MODEL.md` §3.3'teki Mizan uyarısıyla aynı risk), okunabilirlik.
3. (b), (a)'yı **ölçülebilir farkla** geçmiyorsa adapter kullanılmaz —
   fine-tuning'in bedeli (eğitim süresi, geri alınamazlık riski, bakım
   yükü) karşılıksız kalmış demektir.

**Geri alma.** LoRA/QLoRA'nın **tam bu yüzden** seçildiği hatırlanmalı
(`MODEL.md` §4 madde 2 — "geri alınamaz" tam ağırlık ince ayarına
(full fine-tune) karşı bir uyarıydı, LoRA'ya karşı değil):

- Taban model ağırlıkları hiç değişmediği için adapter **silinir**, sistem
  bir önceki duruma (few-shot + üslup profili) döner. Taban modelin yeniden
  eğitilmesi gerekmez.
- Birden çok adapter sürümü saklanabilir (küçük dosya boyutu, §M9.7 adım 7);
  kötü bir sürümden öncekine dönmek dosya değiştirmekten ibarettir.
- Geri alma **hiçbir durumda** eğitim verisini (maskelenmiş JSONL'i) silmeyi
  gerektirmez ya da öngörmez — veri ile adapter ayrı yaşam döngülerine
  sahiptir.
