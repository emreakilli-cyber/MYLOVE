# SORULAR

Takıldığım yerlerde durmadım; varsayımla devam ettim. Her soru için seçenekler
ve **seçtiğim varsayım** aşağıda. İlgili yerlerde koda `// SORU: S<no>` yorumu
bırakıldı. Cevap verildiğinde varsayımı değiştirmek kolay olsun diye her
maddede "değiştirmek gerekirse nereye bakılır" satırı var.

---

## S1 — Belgeler kök `docs/` altında mı, paketin içinde mi?

**Bağlam:** Oturum kapsamı `packages/hukuk-ai/` ile sınırlı, ama verilen yollar
`docs/PLAN-HUKUKAI.md`, `docs/PROTOCOL.md`, `docs/SPEC.md` biçimindeydi.

| Seçenek | Sonuç |
|---|---|
| **A (seçildi)** | Belgeler kök `docs/` altında; verilen yollar birebir uygulandı |
| B | `packages/hukuk-ai/docs/` altında; kapsam yalıtımı daha temiz ama yollar değişir |

**Varsayım:** A. Verilen yollar açıktı ve `docs/PLAN-HUKUKAI.md` zaten kök
`docs/`'u işaret ediyordu. `docs/PLAN.md`'ye dokunulmadı.
**Değiştirmek gerekirse:** dosyaları taşımak yeterli; kod hiçbir belgeye yol ile
bağlı değil.

---

## S2 — Ortak dosyalara (kök `package.json`, `tsconfig`) dokunmadan derleme

**Bağlam:** "Ortak dosyalara yazman gerekirse önce bana sor" denmişti; ayrıca
"bana soru sorma, varsayımla devam et" denmişti. İkisini birden karşılamak için
ortak dosyaya **hiç dokunmadım**.

| Seçenek | Sonuç |
|---|---|
| **A (seçildi)** | Paket sıfır bağımlı, kendi `tsconfig.json`'ı var. Kök `npm test` testleri vitest'in varsayılan deseniyle zaten buluyor. Kök `npm run build` paketi tip denetlemiyor |
| B | Kök `tsconfig.json`'a `references` eklenir → `npm run build` paketi de denetler, ama ortak dosya değişir |
| C | Paket ayrı bir npm workspace olur → kök `package.json` değişir |

**Varsayım:** A. Ortak dosya değişmedi, başka oturumla çakışma riski sıfır.
**Bedeli:** Paketin tip denetimi ayrı komutla koşuyor:
`npx tsc -p packages/hukuk-ai/tsconfig.json --noEmit`. Kök `npm run build` bunu
kapsamıyor — yani paket tipi bozulsa kök derleme yine geçer.
**Değiştirmek gerekirse:** B tek satırlık ek; kök `tsconfig.json`'a
`{ "path": "./packages/hukuk-ai" }` referansı ve pakette `composite: true`.

---

## S3 — `@types/node` bağımlılığı sayılır mı?

**Bağlam:** M0.3 "sıfır bağımlılık" diyor. Paket yalıtım testi (M0.3) dosya
sistemini okuduğu için `node:fs` tiplerine ihtiyaç duyuyor.

**Varsayım:** Tip-düzeyi, yalnız-test bir geliştirme bağımlılığı "sıfır
bağımlılık" kuralını bozmaz. Çalışma zamanı kodunda node API'si yok ve bunu
`package.test.ts` içindeki test doğruluyor (izin listesi: `vitest`, `node:fs`,
`node:path`, `node:url` — yalnız `.test.ts` dosyalarında).
**Değiştirmek gerekirse:** testteki dosya taramasını elle yazılmış bir dosya
listesiyle değiştirip `types: []`'e dönmek mümkün.

---

## S4 — Tarih maskeleme varsayılan olarak açık mı?

**Bağlam:** `SPEC.md` §7/8 — bütün tarihler maskelenirse kronoloji okunmaz hâle
gelebilir; ama tarih de kişisel veri sayılabilir.

| Seçenek | Sonuç |
|---|---|
| **A (seçildi)** | Varsayılan **açık**; `mask(text, { maskDates: false })` ile kapatılır |
| B | Varsayılan kapalı; kullanıcı isterse açar |

**Varsayım:** A. Güvenli taraf varsayılan olmalı; kapatma kararı bilinçli bir
tercih olsun.
**Değiştirmek gerekirse:** `src/mask/rules/index.ts` içinde `ALWAYS_ON` listesine
`detectDate` eklenip varsayılan ters çevrilir.

---

## S5 — Sıfırsız sabit hat telefonu yakalanmalı mı?

**Bağlam:** `212 444 55 66` biçimi, herhangi bir on haneli sayıdan ayırt
edilemiyor (tutar, referans no, sicil no hepsi aynı görünüyor).

| Seçenek | Sonuç |
|---|---|
| **A (seçildi)** | Yakalanmaz. Mobil (`5xx…`) sıfırsız da yakalanır, sabit hat için `0` veya `+90` gerekir |
| B | Yakalanır; yanlış pozitif oranı artar, tutarlar maskelenmeye başlar |

**Varsayım:** A. Yanlış pozitif, hukuki metinde tutarları ve sicil numaralarını
bozar — bu, kaçırılan bir telefondan daha zararlı. Sınır `SPEC.md` §7'ye ve
`phone.ts` başlığına yazıldı.
**Değiştirmek gerekirse:** `src/mask/rules/phone.ts` içindeki `CANDIDATE`
alternatiflerine sıfırsız sabit hat deseni eklenir.

---

## S6 — İç içe geçmiş varlıkta hangisi kazanır?

**Bağlam:** `Ahmet Yılmaz İnşaat Ltd. Şti.` — kurum adının içinde kişi adı var.

| Seçenek | Sonuç |
|---|---|
| **A (seçildi)** | Uzun olan kazanır → tamamı `[KURUM_1]` |
| B | İç içe maskeleme → `[KISI_1] İnşaat Ltd. Şti.` |

**Varsayım:** A. B seçeneği hem okunaksız hem de kişi kimliğini sızdırıyor
(kurum adından kişi çıkarılabiliyor). `SPEC.md` §6.2'ye gerekçesiyle yazıldı.
**Not:** `Egeperla AVM sahibi Ahmet Yılmaz` örneği bundan farklıdır — orada
aralıklar kesişmiyor, ikisi de ayrı ayrı maskeleniyor.
**Değiştirmek gerekirse:** `src/mask/overlap.ts` içindeki `compare` sıralaması.

---

## S8 — Üslup profilindeki örnek paragraflar sınırsız mı büyür?

**Bağlam:** `CAPABILITIES.md` A8, "her belgeden 2-3 temsilî paragraf örneklenip
profile iliştirilir" derken profili "birkaç KB'lık" olarak tanımlıyor. 200
belgelik bir korpusta belge başına 2-3 paragraf tutulursa (600 paragraf ≈
100+ KB) bu iki cümle birbiriyle çelişiyor: literal biriktirme "birkaç KB"
sınırını kolayca aşıyor.

| Seçenek | Sonuç |
|---|---|
| **A (seçildi)** | `sampleParagraphs` en son eklenen **24** paragrafla sınırlı (kayan pencere); eskiler düşer |
| B | Sınırsız biriktirme; "birkaç KB" ifadesi yalnız sayısal alanlar için geçerli sayılır |
| C | Paragraflar profilden ayrı, sınırsız büyüyebilen bir korpusta tutulur; profil yalnız sayısal alanları taşır |

**Varsayım:** A. "Birkaç KB" sınırını profilin TAMAMI için (paragraflar dâhil)
ciddiye almak, tek bir `StyleProfile` nesnesinin bellek/depolama ayak izini
öngörülebilir tutuyor. Kayan pencere, en güncel yazım alışkanlığını da temsil
ediyor — eski bir üslubun kalıcı olarak ağırlık taşıması istenmez.
**Bedeli:** Az sayıda belge işlendiğinde (< 8 belge) tüm örnekler tutulur; ondan
sonra en eski örnekler M8.5 few-shot seçiminden düşer.
**Değiştirmek gerekirse:** `src/write/style.ts` içindeki `MAX_SAMPLE_PARAGRAPHS`
sabiti; C seçeneği için `sampleParagraphs` alanı `StyleProfile`'dan çıkarılıp
ayrı bir `FewShotCorpus` deposuna taşınmalı (paket dışına, kalıcı depolama
katmanına).
**Cevap:** _(boş bırak)_
