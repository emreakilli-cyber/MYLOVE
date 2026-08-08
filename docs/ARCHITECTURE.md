# ARCHITECTURE — `packages/hukuk-ai`

Plan M10. Bu belge kod yazmaz, var olan kodu haritalar. `CAPABILITIES.md`
**ne**'yi, `PROTOCOL.md` telefon↔masaüstü **nasıl**'ını, `SPEC.md` maskeleme
**nasıl**'ını tanımlar; bu belge bunların paket içinde **nereye** düştüğünü
gösterir.

**Yapım durumu (dürüstçe):** Maskeleme (M2–M6, M11), araştırma katmanı + kapı
(M7), yazma katmanı (M8) ve devir eşiği hesaplaması (M12.9/`handoff/`) kodda
var ve test altında. `PROTOCOL.md`'nin taşıma/eşleşme/el sıkışma uygulaması
(`src/protocol/`) **henüz yazılmadı** — bu belge o hâlde de neyin çalışmaya
devam edeceğini (§4) baştan garanti altına almak için var.

---

## 1. Modül haritası ve bağımlılık yönü (M10.1)

```
types/entities.ts   turkish/suffix.ts        (yaprak — iç bağımlılığı yok)
        │                    │
        │        ┌───────────┴───────────┐
        │        │                       │
        ▼        ▼                       ▼
  mask/token.ts  mask/ner/dictionary.ts  mask/review.ts ─┐
  mask/overlap.ts                                        │
  mask/ner/types.ts                                       │
  mask/rules/* (caseNo, date, email, iban,                │
                phone, plate, tckn → shared.ts)            │
        │                                                  │
        ▼                                                  │
  mask/table.ts (types + token)                            │
        │                                                  │
        ▼                                                  │
  mask/mask.ts (types + ner + overlap + rules + table + token)
        │                                                  │
        ├──────────────────────────────────────────────────┘
        ▼
  mask/preflight.ts (mask/mask)
        │
        ▼
  research/guard.ts (mask/ner + mask/overlap + mask/rules + types — mask/table'a DOKUNMAZ, bkz. §5)
        │
        ▼
  research/client.ts (research/guard)
        │
        ▼
  research/correlate.ts (yalnız research/client'ın tipini kullanır — Belge
                          içeriğine değil, ResearchDocument tipine bağlı)

  handoff/threshold.ts                    write/skeleton.ts ─┐
  (yaprak — hiçbir iç modülü               write/fewShot.ts ─┤ yaprak
   import etmez, saf fonksiyon)                                │
                                            write/styleProfile.ts (skeleton)
                                            write/staged.ts (fewShot + styleProfile)

  index.ts → yukarıdakilerin TAMAMINI dışa açar (tek kapı, M13.1)
```

| Modül | İç bağımlılığı | Dışa bağımlılığı |
|---|---|---|
| `types/entities.ts` | yok | yok |
| `turkish/suffix.ts` | yok | yok |
| `mask/rules/*` | `types`, birbirleri (`shared.ts` üzerinden) | yok |
| `mask/ner/*` | `types`, `turkish/suffix.ts` (yalnız `dictionary.ts`) | yok |
| `mask/token.ts`, `mask/overlap.ts` | `types` | yok |
| `mask/table.ts` | `types`, `mask/token.ts` | yok |
| `mask/mask.ts` | `types`, `mask/ner`, `mask/overlap`, `mask/rules`, `mask/table`, `mask/token` | yok |
| `mask/review.ts` | `types`, `turkish/suffix`, `mask/mask`, `mask/table`, `mask/token` | yok |
| `mask/preflight.ts` | `mask/mask`, `types` | yok |
| `research/guard.ts` | `types`, `mask/ner`, `mask/overlap`, `mask/rules` | yok |
| `research/client.ts` | `research/guard` | yok (taşıma dışarıdan `ResearchTransport` ile enjekte edilir) |
| `research/correlate.ts` | `research/client` (yalnız tip) | yok |
| `write/*` | yalnız kendi içinde (`skeleton` ← `styleProfile`; `fewShot` + `styleProfile` ← `staged`) | **hiçbiri** — `mask/`, `research/`, `handoff/` hiçbirine dokunmaz |
| `handoff/threshold.ts` | yok | yok (saf fonksiyon) |
| `index.ts` | hepsi (tek kapı) | yok |

Paket sıfır çalışma-zamanı bağımlılığı taşır ve ana uygulamadan hiçbir şey
import etmez; bu, `src/package.test.ts` ile mekanik olarak doğrulanır (M0.3).

---

## 2. Telefon–masaüstü iş bölümü (M10.2)

`CAPABILITIES.md` A/B listesiyle birebir. Bu belge listeyi tekrar etmez,
listedeki her maddenin paket içinde **hangi kod yoluna** düştüğünü gösterir.

| `CAPABILITIES.md` maddesi | Paket karşılığı | Nerede çalışır |
|---|---|---|
| A3 Maskeleme | `mask/*` (kural + NER) | telefon, kısıtsız |
| A4/A5/A10/A11 aşamalı çıkarım/özet/sentez/tarama | paket dışı (ana uygulamanın iş kuyruğu + paketin `mask`/`write` yardımcıları) | telefon, kuyruklu |
| A6 Karar/mevzuat arama, özetleme, ilişkilendirme | `research/client.ts` (arama+kapı) + `research/correlate.ts` (özet+ilişki, K bağımsız geçiş) | arama telefonda tetiklenir, ağ **yalnız bu modülden**; özetleme/ilişkilendirme cihaz içi modelle, ağa çıkmaz |
| A7/A9 Şablon evrak, düzenleme | paket dışı (ana uygulama şablon motoru) + `write/*` (serbest metin boşlukları, bölüm yeniden yazımı) | telefon |
| A8 Üslup profili | `write/styleProfile.ts` (`addDocument` — artımlı) | telefon, belge belge |
| A13 Uzun layiha | `write/skeleton.ts` (iskelet) + `write/fewShot.ts` (bağlam seçimi) + `write/staged.ts` (bölüm bölüm üretim + tutarlılık geçişi) | telefon |
| B1 27B+ çıkarım, B2 LoRA/QLoRA eğitimi, B3 kuantizasyon | paket **kapsamı dışında** — bunlar model çalıştırma/eğitme altyapısı, host uygulamanın (masaüstü) sorumluluğu. Paket yalnız `WriteBackend`/`CorrelationBackend`/`SummaryBackend`/`NerBackend` **arayüzlerini** tanımlar; hangi modelin bunları uyguladığı paketin dışındadır | masaüstü (isteğe bağlı) |
| §C Devir eşikleri | `handoff/threshold.ts` (`shouldOfferHandoff`) | telefon, saf hesap — ağ yok, cihaz yok |
| §C.8 Devir teslimin kendisi (`PROTOCOL.md`) | `src/protocol/` — **henüz yazılmadı**, bkz. §4 | ikisi birden (owner/worker) |

**Gözlem:** Paketin bugün yazılı kodu (M2–M8, M11, M12.9) tamamı telefon
tarafıdır. Masaüstüne özgü tek şey B1–B3'ün kendisidir (model çalıştırma/
eğitme) ve paket ona **arayüzle** bakar, kod olarak sahip değildir — bu
`CAPABILITIES.md`'nin "masaüstü hiç olmasa da telefon her işi bitirir"
ilkesinin (§A giriş) doğal sonucudur.

---

## 3. Devir teslim mimarisi (M10.3)

Ayrıntılı sözleşme `PROTOCOL.md`'dedir; bu bölüm onun paket içindeki
karşılığını gösterir, sözleşmeyi tekrarlamaz.

| `PROTOCOL.md` bölümü | Paket karşılığı |
|---|---|
| §1 Değişmezler (G1–G7) | G1 → `mask/table.ts` (`toJSON` yok, M5.5); G2 → `maskEvidence` üretimi **henüz yazılmadı** (protokol katmanının işi, §4); G7 → `handoff/threshold.ts` zaten "masaüstü yok" durumunu varsayılan kabul eder, özel kod gerektirmez |
| §5.3 `maskEvidence.maskTableHash` | `mask/table.ts`'nin `sha256` özet üretimi (M5.6) — tablonun **kendisi değil**, özeti |
| §6 Durum makineleri (telefon `LOCAL_QUEUED`→…, masaüstü `IDLE`→…) | paket dışı — bu durum makineleri host uygulamanın iş kuyruğuna bağlanacak; paket yalnız "devir teklif edilsin mi" (`shouldOfferHandoff`) sorusuna cevap verir, teklifin **yürütülmesine** karışmaz |
| §7.3 Çakışmada telefon kazanır (G4) | paket dışı — bağlantı/eşleşme mantığı `src/protocol/`'e ait, henüz yok |
| §8 `maskContractVersion` uyuşmazlığı | `SPEC.md` §1.6'daki `maskContractVersion` sabiti (`1.0.0`) paketin kendi sürümüdür; `PROTOCOL.md` §8 bunu **okur**, paket `PROTOCOL.md`'yi import etmez (belge, kod değil) |

**Kasıtlı ayrım:** Paket, "ne zaman devredilsin" (eşik) ile "devir nasıl
yürütülsün" (taşıma, eşleşme, mesaj zarfı) sorularını **ayrı** tutar.
`handoff/threshold.ts` birinciyi cevaplar ve zaten tam test altındadır
(M12.9). İkincisi `PROTOCOL.md`'nin geri kalanının kod karşılığıdır ve ayrı
bir plan maddesi (`src/protocol/` altında, M10 sonrasına) gerektirir — bu
belgeye yeni madde eklemek yerine mevcut plan sırasına bırakıldı çünkü A
listesindeki hiçbir iş ona bağlı değil (§4).

---

## 4. Telefon tek başına tam işlevsel (M10.4)

`CAPABILITIES.md` A listesinin **tamamı**, masaüstü modülü (`src/protocol/`
uygulaması) hiç yazılmasa bile çalışır. Bunun kodda nasıl garanti edildiği:

1. **`handoff/threshold.ts` bağımsızdır.** `DeviceState.desktopPaired`
   verilmezse (yani eşleşmiş masaüstü yoksa) `shouldOfferHandoff` teklif
   üretmez — bu, eşleşme kodu yazılmadan da test edilebilir bir davranıştır
   (`threshold.test.ts`), çünkü fonksiyon saf ve girdisi dışarıdan verilir.
2. **`research/client.ts` taşımayı enjekte alır.** `ResearchTransport`
   dışarıdan verilir (`research/client.ts` §üstbilgi); host uygulama
   `transport` vermezse `LocalResearchIndex` üzerinden çevrimdışı cevap döner
   (M7.7) — ağ da, masaüstü de yoksa bile araştırma katmanı çöküp durmaz.
3. **`write/*` hiçbir yere bağlı değildir.** Üslup profili, iskelet çıkarma,
   few-shot seçimi ve aşamalı üretim yalnız kendi aralarında bağımlıdır
   (§1 tablosu); ne masaüstüne ne ağa ne devir mantığına ihtiyaç duyarlar —
   model çağrısı `WriteBackend` arayüzüyle enjekte edilir, o arayüzün cihaz
   içi modelle mi 27B modelle mi doldurulduğu paketin bilmediği bir karardır.
4. **`mask/*` zaten hiçbir dış bağımlılık taşımaz** (§1) — maskeleme A3
   gereği zaten "kısıtsız, tek başına" olmak zorunda.

**Sonuç:** Bugünkü kod tabanında masaüstüyle ilgili **tek** satır
`handoff/threshold.ts`'deki `desktopPaired` alanı ve arayüzlerin isimleridir
(`WriteBackend`, `CorrelationBackend`, vb. — bunlar "bir model bunu
uygulayabilir" der, "bu model masaüstündedir" demez). `src/protocol/`
yazıldığında bile bu değişmeyecek, çünkü protokol katmanı yalnız
`handoff/threshold.ts`'in `true` dediği **anlardan sonra** devreye girecek
şekilde tasarlandı (§3) — telefon akışının **içine** değil, **yanına** eklenir.

---

## 5. Veri akışı diyagramı (M10.5)

```
ham metin (müvekkil verisi, cihazda)
      │
      ▼
┌─────────────────┐   S3: koşamazsa hiçbir şey ileri gitmez
│  mask() (M2–M6)  │──────────────────────────────────────────┐
└─────────────────┘                                            │
      │ MaskResult { text: maskelenmiş, table, spans, suspects}│ (hata/eksik → akış
      │                                                        │  burada durur,
      ▼                                                        │  DIŞARI VERİ GİTMEZ)
┌──────────────────────────────────────────────────────────┐  │
│  onay ekranı (MaskReview, M6) — kullanıcı isterse düzeltir │◄─┘
└──────────────────────────────────────────────────────────┘
      │ maskelenmiş metin (+ table yalnız cihazda kalır)
      │
      ├─────────────────────┬─────────────────────────────┐
      ▼                      ▼                             ▼
┌──────────────┐   ┌──────────────────────┐    ┌───────────────────────┐
│ yerel işlem    │   │ research/ (M7)        │    │ devir (PROTOCOL.md,   │
│ write/* (M8)   │   │ MaskGuard zorunlu kapı│    │ henüz yazılmadı)      │
│ — ağ yok       │   │ → yalnız BU modül ağa │    │ maskEvidence + hash   │
│                │   │   çıkar (A6)          │    │ gider, table gitmez   │
└──────────────────┘ └──────────────────────┘    └───────────────────────┘
      │                      │                             │
      └──────────┬───────────┴─────────────┬───────────────┘
                  ▼                         ▼
           maskelenmiş sonuç         maskelenmiş sonuç
           (özet/taslak/karar)       (devirden dönen iş)
                  │                         │
                  └────────────┬────────────┘
                                ▼
                      ┌──────────────────┐
                      │  unmask() (M5.4)  │  — birebir (S1)
                      └──────────────────┘
                                │
                                ▼
                        kullanıcıya gösterilen
                        nihai metin (cihazda)
```

**Okunuşu:** Ham metin cihazdan **hiçbir zaman** maskesiz çıkmaz — üç dal da
(yerel işlem, araştırma, devir) maskelenmiş metinle beslenir. `research/`
dalı ayrıca kendi kapısından (`MaskGuard`) tekrar geçer (M7.2/M7.3) çünkü o,
gerçekten ağa çıkan tek noktadır ve "önce maskele" sözüne güvenmek yerine
zorlar. Devir dalı bugün diyagramda yer alır ama kod karşılığı henüz yok (§4);
yer alma sebebi, ileride yazıldığında **aynı** maskelenmiş-girdi kuralına
uyacağının şimdiden belgelenmesidir.

---

## 6. Kırmızı çizgiler (M10.6)

Hangi modül hangisini **import edemez** — gerekçesiyle. "Mekanik" sütunu,
kuralın bugün bir testle mi yoksa yalnız kod incelemesiyle mi korunduğunu
gösterir; dürüstçe işaretlenmiştir, hepsi test altında değildir.

| Kırmızı çizgi | Gerekçe | Mekanik |
|---|---|---|
| `research/*` ↛ `mask/table.ts` | Araştırma katmanı maske **tablosuna** ihtiyaç duymaz, yalnız maskelenmiş **metne** bakar (kapı bunu doğrular). Tabloya erişimi olsaydı, ağa çıkan modülün gerçek değerlere teorik erişimi olurdu — G1'in ruhuna aykırı | kod incelemesiyle (§1 tablosu); ayrı bir test yok — **not:** `package.test.ts` yalnız paket-dışı sınırı denetler, paket-içi bu kırmızı çizgiyi henüz denetlemiyor |
| `write/*` ↛ `mask/*`, `write/*` ↛ `research/*` | Yazma katmanı hangi metnin maskelenmiş olduğunu bilmek zorunda değildir — çağıran taraf (host uygulama) zaten maskelenmiş girdiyi verir; katman saf metin/profil/iskelet üzerinde çalışır | bugün **doğal olarak sağlanıyor** (§1'deki bağımlılık tablosunda `write/*` satırı boş) — mekanik zorlama yok, yalnız gözlem |
| `write/*` ↛ ağ | M8.1 zaten test ediyor: modülde ağ çağrısı yok | test (`write.test.ts`, M8.1) |
| `mask/ner/*` ↛ ağ | M3.6 zaten test ediyor | test (`ner.test.ts`, M3.6) |
| Hiçbir modül ↛ ana uygulama (`../../src`) | Paket yalıtımı | test (`package.test.ts`, M0.3) |
| Masaüstü (ileride `src/protocol/`) ↛ kalıcı depolama | `PROTOCOL.md` G3 — masaüstü durumsuzdur | **henüz uygulanmadı** — protokol katmanı yazıldığında bu kırmızı çizgi kod incelemesiyle korunmalı, mümkünse testle (iş bitince/iptalde/kopmada disk ve bellek izinin kalmadığını doğrulayan test) |
| `MaskTable` ↛ `JSON.stringify` üzerinden sızıntı | G1 | test (`table.test.ts` kapsamında, M5.5) |

**Açık nokta:** Paket-içi kırmızı çizgilerin (ilk iki satır) bugün yalnızca
kod incelemesiyle korunması, gelecekte bir katman yanlışlıkla `mask/table.ts`
veya `research/*`'i import ederse **derleme geçer, test kırmızıya dönmez** —
sessizce ihlal edilebilir. Bunu `package.test.ts`'teki desene benzer bir
"dizin-içi import haritası" testiyle kapatmak M13 sonrası bir aday; bu belge
yalnız boşluğu **kayda geçirir**, kapatmaz (kapsam M10, kod yazımı değil).
