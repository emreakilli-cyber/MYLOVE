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

## S7 — Kalıp ifade / terim tercihi sözlüğü sabit mi, büroya göre mi?

**Durum:** M8.3, üslup profili şeması. "Kalıp ifadeler" ve "terim tercihleri"
alanları için bir başlangıç kelime dağarcığı gerekiyordu ama her hukuk
bürosunün kendi kalıpları farklıdır; kullanıcıya soru sorulamadı.

**Soru:** Kalıp ifade/terim listesi kodda sabit mi tutulsun, yoksa ilk
sürümden itibaren kullanıcı tanımlı bir sözlükle mi açılsın?

**Seçenekler:**
A) Kodda sabit, yaygın TR dilekçe kalıplarından oluşan küçük bir liste
   (`FORMULAIC_PHRASES`, `TERM_VARIANTS` — `write/styleProfile.ts`); profil
   yalnız bu listede geçenleri sayar, listede olmayan kalıplar görünmez.
B) Baştan kullanıcı tanımlı/genişletilebilir sözlük; daha doğru ama paket
   sıfır bağımlılık + model yok ilkesiyle çelişmeyen bir yapılandırma arayüzü
   gerektirir, kapsam büyür.
C) NER/model tabanlı otomatik kalıp keşfi (n-gram sıklığı); veri az olduğunda
   (birkaç dilekçe) gürültülü sonuç verir.

**Şimdilik seçtiğim:** A — çünkü M8, "modelsiz varsayılan uygulama çalışsın"
ilkesini (M3.3 ile aynı) izliyor; sabit liste hem deterministik hem test
edilebilir. Liste eksik kalır ama yanlış pozitif üretmez, yalnızca bazı
kalıpları kaçırır — bu, M1.5 "bilinen sınırlar" ruhuyla tutarlı.

**Etkilenecek dosyalar:** `packages/hukuk-ai/src/write/styleProfile.ts`
(`FORMULAIC_PHRASES`, `TERM_VARIANTS` sabitleri; kod içinde `// SORU: S7`
işaretli).

**Cevap:** _(boş bırak)_
