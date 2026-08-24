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

## S7 — Müvekkil listesindeki "bekleyen ödeme" tutarı neyi saymalı?

**Bağlam:** Müvekkiller sayfasında her müvekkilin yanında amber bir tutar
rozeti (`MuvekkilSatiri.bekleyenOdeme`) gösteriliyor. Şu an bu tutar, o
müvekkile bağlı **tüm** ödemesi tamamlanmamış finans kayıtlarının kalanını
(`tutar - odenenTutar`) topluyor — hem **gelir** (müvekkilin borcu, ör. vekâlet
ücreti) hem **gider** (harç, bilirkişi, tebligat) birlikte. Oysa büro genel
finans özeti (`finansGenelOzetHesapla`) "bekleyen ödeme"yi **yalnız gider**
sayar; tahsil edilmemiş geliri ise ayrı bir kavram olan "bekleyen tahsilat"
kabul eder (bkz. `finansSorgulari.test.ts` başlığı: "ödeme = gider, tahsilat =
gelir"). Yani alan adı ("ödeme") ile içerik (gelir+gider) ve genel özetle
tutarlılık arasında bir gerilim var.

**Ek bilgi:** Aynı "gelir+gider birlikte" konvansiyonu dosya düzeyinde de
mevcut (`finansOzeti(...).bekleyen` — dosya detayı + müvekkil profili özeti).
Yani bu tek bir yerdeki kaza değil, **tutarlı bir varlık-bazlı konvansiyon**;
yalnız büro geneli (`finansGenelOzetHesapla`) gider-only. Karar hem
`bekleyenOdemeHaritasi` hem `finansOzeti.bekleyen`'i etkiler — B/C seçilirse
ikisi birlikte değiştirilmeli.

| Seçenek | Sonuç |
|---|---|
| **A (mevcut — korundu)** | Gelir+gider tüm açık kalemler toplanır → "müvekkile bağlı toplam açık tutar". Basit ama alan adı ve genel özetle çelişir |
| B | Yalnız tahsil edilmemiş **gelir** (müvekkilin borcu). Muhtemelen en anlamlısı; alan `bekleyenTahsilat` olarak yeniden adlandırılır ve rozet "tahsilat" olarak etiketlenir |
| C | Yalnız **gider** (alan adının sözlük anlamı; genel özetle bire bir tutarlı) ama müvekkil listesinde pek işe yaramaz |

**Varsayım:** A (mevcut davranış). Bir para göstergesini tahminle yeniden
tanımlamak riskli olduğundan davranış **değiştirilmedi**; yalnız saf fonksiyon
olarak çıkarılıp `bekleyenOdemeHaritasi` testleriyle kilitlendi ve karar
kullanıcıya bırakıldı. Ürün amacı netleşince B en olası doğru seçenek.
**Değiştirmek gerekirse:** `src/data/muvekkilSorgulari.ts` içindeki
`bekleyenOdemeHaritasi` — B için `f.yon === 'gelir'`, C için `f.yon === 'gider'`
filtresi eklenir; B'de alan/rozet adı da güncellenir. Test:
`muvekkilSorgulari.test.ts`.
