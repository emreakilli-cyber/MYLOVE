# API — `packages/hukuk-ai` genel yüzeyi

Plan M13. Tek giriş noktası `src/index.ts`'tir (M13.1) — burada listelenen her
şey oradan dışa açılır, başka hiçbir yoldan import edilmez.

Çapraz bağlar: madde numaraları (M2.x, S3 vb.) `docs/SPEC.md`,
`docs/PROTOCOL.md`, `docs/CAPABILITIES.md` ve `docs/PLAN-HUKUKAI.md`'deki
karşılıklarına işaret eder. Bu belge o üçünü **tekrarlamaz**, yalnız kod
yüzeyini belgeler; davranış çelişirse bağlayıcı olan onlardır.

---

## Kararlılık (M13.5)

| Yüzey | Durum | Gerekçe |
|---|---|---|
| `mask`, `maskAsync`, `unmask`, `MaskTable`, `MaskReview`, `preflightCheck`, `runRuleLayer`, `isValidTckn`, `isValidIban`, `normalizePhone`, `isMaskToken`, `nameKey`, `splitName`, `ENTITY_TYPES`, `TYPE_PRIORITY` | **Kararlı** | M1–M6, M11, M12'nin tam test kapsamı var; `SPEC.md` §1'deki değişmezlerle (S1–S7) korunuyor, sürüm artışıyla bile bozulamaz |
| `createDictionaryNerBackend`, `freeRegions`, `NerBackend`/`AsyncNerBackend` arayüzleri | **Kararlı** | Arayüz sözleşmesi (M3.2) sabit; yalnız varsayılan uygulama (sözlük) ileride model tabanlı backend'lerle **yanına eklenerek** genişler, kaldırılmaz |
| `ResearchClient`, `assertMasked`, `findUnmaskedContent`, `UnmaskedContentError` | **Kararlı** | M7.1–M7.5 tam test kapsamlı; `MaskGuard` kapısı PROTOCOL G2'nin doğrudan uygulaması |
| `THRESHOLDS`, `shouldOfferHandoff` | **Kararlı** | M12.9 sınır değeri testleriyle doğrulanmış; `CAPABILITIES.md` §C'ye birebir bağlı |
| `summarizeResults`, `correlateResults` (M7.6) | **Kararlı** | Küçük, deterministik orkestrasyon; backend arayüzü dar ve testlerle kilitli |
| `write/*` — `extractSkeleton`, `addDocument`/`StyleProfile`, `selectFewShot`, `writeStaged`/`checkConsistency`/`reviewSectionConsistency` (M8) | **Deneysel** | Gerçek bir `WriteBackend` uygulamasıyla henüz uçtan uca denenmedi; `styleProfile.ts` açık soru S7'ye bağlı (bkz. `docs/QUESTIONS.md`) — cevap değişirse `StyleProfile` şeması değişebilir |

Deneysel işaretli yüzeyler **çalışır ve testlidir** — "kırılgan" değil,
"sözleşmesi henüz gerçek kullanımla sertleşmedi" anlamına gelir. Sürüm
artışında önce kararlı yüzeyler korunur.

---

## Hata tipleri kataloğu (M13.3)

| Tip | Nereden | Ne zaman fırlar | Nasıl ele alınır |
|---|---|---|---|
| `UnmaskedContentError` | `research/guard.ts` | Ağa çıkan bir sorguda maskelenmemiş kimlik verisi bulunursa (M7.2) | Yakalanıp kullanıcıya "önce maskele" mesajı gösterilir; `error.findings` bulunan tipleri taşır, ham değeri **taşımaz** |
| `MaskReviewError` | `mask/review.ts` | Geçersiz aralık (`addMask`/`applyToAll`), bilinmeyen token (`linkToExisting`/`removeMask`), ya da manuel maske eklenip token üretilemezse | Kullanıcı girdisini doğrulayan bir UI hatasıdır; mesajı doğrudan gösterilebilir |
| `MaskTableSerializationError` | `mask/table.ts` | `JSON.stringify(table)` / `table.toJSON()` çağrılırsa (SPEC S2), ya da `exportEncrypted` 8 karakterden kısa parola alırsa | **Beklenen** hatadır — tablo asla düz serileşmemeli; parola uzunluğunu kullanıcıya sorup tekrar dene |
| `MaskTableDecryptError` | `mask/table.ts` | `importEncrypted` bilinmeyen `format` görürse ya da AES-GCM doğrulaması başarısız olursa (yanlış parola/bozuk veri — ikisi kasıtlı olarak ayırt edilmez) | Kullanıcıya "parola yanlış ya da veri bozuk" gösterilir, ayrım yapılmaz (güvenlik) |
| `TokenBudgetExceededError` | `write/staged.ts` | Bir bölümün prompt'u (`writeSection`) ya da tutarlılık geçişinin özet toplamı (`reviewSectionConsistency`) bağlam bütçesini aşarsa | **Sessizce kırpılmaz** — olgu/few-shot sayısı azaltılıp yeniden denenir |
| `RangeError` | `mask/token.ts` (`buildToken`) | `ordinal < 1` ya da tam sayı değilse | İç kullanım; dışarıdan çağrılmaz, bir çağıran hatasına işaret eder |

Hiçbir hata nesnesi ham kimlik verisi taşımaz (`UnmaskedContentError.findings`
yalnız `preview` — ilk/son iki karakter dışı `•` — taşır; SPEC §7/3).

---

## `mask/mask.ts` — maskeleme ve geri alma

### `mask(input, options?) → MaskResult`

```ts
function mask(input: string, options?: MaskOptions): MaskResult
```

- **`input`**: ham metin.
- **`options.table`**: var olan `MaskTable`'a eklemek için (SPEC §4.2, belgeler
  arası kişi tutarlılığı).
- **`options.maskDates`**: `false` verilirse tarih tipi maskelenmez (SPEC §7/8).
- **`options.ner`**: `NerBackend` — verilmezse yalnız kural katmanı koşar.
- **Dönüş — `MaskResult`**: `{ text, table, spans, suspects }`.
- **Hata fırlatmaz.**

```ts
const result = mask('Müvekkil Ahmet Yılmaz, TC 10000000146.')
// result.text   → "Müvekkil [KISI_1], TC [TCKN_1]."
// result.table  → MaskTable — unmask için gerekli
```

### `maskAsync(input, options?) → Promise<MaskResult>`

`mask` ile aynı, `options.ner` bir `AsyncNerBackend` da olabilir (cihaz içi
model çıkarımı eşzamansızdır — `MODEL.md` §3.1). Model tabanlı backend
kullanılacaksa bu, sözlük tabanlı senkron backend'de `mask()` yeterlidir.

### `unmask(text, table) → UnmaskResult`

```ts
function unmask(text: string, table: MaskTable): UnmaskResult
```

- **`text`**: token içeren metin (model çıktısı olabilir).
- **`table`**: `mask()`'tan gelen `MaskTable`.
- **Dönüş**: `{ text, unresolved }` — `unresolved`, tabloda karşılığı olmayan
  token'lar (SPEC §5.1). **Hata fırlatmaz**, bilinmeyen token olduğu gibi
  bırakılır.

```ts
const { text, unresolved } = unmask('[KISI_1] imza attı.', result.table)
// unresolved boşsa geri dönüş tamdır (SPEC S1: unmask(mask(x)) === x)
```

---

## `mask/table.ts` — `MaskTable`

Eşleme tablosu. **Serileştirilemez** (SPEC S2 / PROTOCOL G1) — `toJSON()`
kasıtlı olarak `MaskTableSerializationError` fırlatır.

| Üye | İmza | Ne yapar | Hata |
|---|---|---|---|
| `tokenFor` | `(type, key, surface, index) => string` | Anahtar için token üretir/döndürür; aynı anahtar hep aynı token'ı alır (S4) | — |
| `surfaceAt` | `(token, nth) => string \| undefined` | Token'ın n'inci geçişinin ham yazımı; sıra taşarsa kanonik yazıma düşer | — |
| `lookup` | `(token) => MaskEntry \| undefined` | Token'dan tam kayda | — |
| `tokenOf` | `(type, key) => string \| undefined` | Anahtardan token'a | — |
| `hasKey` | `(type, key) => boolean` | Anahtar tabloda var mı | — |
| `markAmbiguous` | `(token, candidates?) => void` | Belirsiz işaretle (SPEC §7/7) | — |
| `entries` | `() => readonly MaskEntry[]` | Onay ekranı listesi (M6.1), ilk geçiş sırasına göre | — |
| `remove` | `(token) => boolean` | Kaydı kaldırır (M6.4) | — |
| `clear` | `() => void` | Oturum sonu temizliği (M5.7) | — |
| `digest` | `() => Promise<string>` | Ağa çıkabilen TEK biçim: `"sha256:..."` (PROTOCOL §5.3) | — |
| `toJSON` | `() => never` | **Her zaman** fırlatır | `MaskTableSerializationError` |
| `exportEncrypted` | `(passphrase, iterations?) => Promise<EncryptedMaskTable>` | AES-GCM şifreli, cihazda saklanabilir blob (M5.7). Parola < 8 karakter | `MaskTableSerializationError` |
| `importEncrypted` *(static)* | `(blob, passphrase) => Promise<MaskTable>` | Şifreli blobdan geri kurar | `MaskTableDecryptError` (yanlış parola/bozuk veri/bilinmeyen format) |

```ts
const blob = await table.exportEncrypted('en-az-8-karakter')
const restored = await MaskTable.importEncrypted(blob, 'en-az-8-karakter')
```

---

## `mask/review.ts` — `MaskReview` (onay ekranı API'si, M6)

Saf veridir; DOM'a dokunmaz (M6.7). Her müdahalede tablo **baştan** yeniden
hesaplanır (bkz. dosya başı yorumu — M6.6'yı tanım gereği sağlar).

```ts
const review = new MaskReview(rawText, { ner })
```

| Üye | İmza | Ne yapar | Hata |
|---|---|---|---|
| `sourceText` *(getter)* | `string` | Kaçışlanmış ham metin — tüm aralıklar buna göre | — |
| `maskedText` *(getter)* | `string` | Güncel maskelenmiş çıktı | — |
| `table` *(getter)* | `MaskTable` | Güncel tablo | — |
| `listMasks` | `() => readonly ReviewMask[]` | Maske listesi (M6.1) | — |
| `addMask` | `(range, type) => string` | Elle maske ekle, token döner (M6.2) | `MaskReviewError` (geçersiz aralık) |
| `linkToExisting` | `(range, token) => void` | Seçimi mevcut maskeye bağla (M6.3) | `MaskReviewError` (bilinmeyen token/aralık) |
| `removeMask` | `(token) => void` | Maskeyi kaldır (M6.4) | `MaskReviewError` (bilinmeyen token) |
| `applyToAll` | `(range, type) => string` | Kökün TÜM geçişlerini bağlar, token döner (M6.5) | `MaskReviewError` (geçersiz aralık) |

```ts
const token = review.addMask({ start: 12, end: 24 }, 'KISI')
review.applyToAll({ start: 12, end: 24 }, 'KISI') // aynı kökün her geçişi
```

---

## `mask/preflight.ts` — `preflightCheck`

```ts
function preflightCheck(text: string, options: PreflightOptions): PreflightResult
```

- **`options.destination`**: `'local' | 'network'` — `'network'`'te
  `canSendUnmasked` **her zaman** `false` döner (M11.5).
- **Dönüş — `PreflightResult`**: `{ clean, entities, suspects, maskedPreview, canSendUnmasked }`.
- **Hata fırlatmaz.**

```ts
const check = preflightCheck(userInput, { destination: 'network' })
if (!check.clean) {
  // "maskele ve gönder" (check.maskedPreview.text) / "iptal" — "maskesiz gönder" YOK
}
```

---

## `mask/rules/index.ts` — kural katmanı

| Üye | İmza | Ne yapar | Hata |
|---|---|---|---|
| `runRuleLayer` | `(text, options?) => RuleResult` | Tüm deterministik dedektörleri koşturur (M2); `{ spans, suspects }` döner | — |
| `isValidTckn` | `(value: string) => boolean` | 11 hane + resmî TCKN algoritması (M2.1) | — |
| `isValidIban` | `(raw: string) => boolean` | TR IBAN + mod-97 (M2.2) | — |
| `normalizePhone` | `(raw: string) => string \| undefined` | 10 haneli kanonik forma indirger, geçersizse `undefined` (M2.3) | — |
| `detectTckn`, `detectIban`, `detectPhone`, `detectPlate`, `detectDate`, `detectEmail`, `detectCaseNumber` | `(text) => RuleResult` | Tek tip dedektörleri, ayrı ayrı da çağrılabilir | — |

```ts
isValidTckn('10000000146') // → true (sınama TCKN'si)
normalizePhone('0532 111 22 33') // → '5321112233'
```

---

## `mask/ner/*` — NER katmanı arayüzü ve varsayılan uygulama

`NerBackend` / `AsyncNerBackend` arayüzleri M3.2'de sabittir; `runsLocally:
true` ağ yasağını tip düzeyinde taşır.

```ts
function createDictionaryNerBackend(options?: DictionaryNerOptions): NerBackend
function freeRegions(textLength: number, taken: readonly {start,end}[]): readonly FreeRegion[]
```

- **`createDictionaryNerBackend`**: cihazdaki müvekkil/karşı taraf/vekil
  kayıtlarından (`options.people`/`organizations`/`workplaces`) ve unvan/kurum
  ipuçlarından (`Av.`, `Ltd. Şti.`, `Mah.`, `AVM`…) üretir; model gerekmez
  (M3.3). Hata fırlatmaz.
- **`freeRegions`**: kural katmanının dokunmadığı boşlukları hesaplar; NER
  yalnız bu aralıklarda çalışmak zorundadır (S5).

```ts
const ner = createDictionaryNerBackend({ people: ['Ahmet Yılmaz'] })
mask('Ahmet Yılmaz beyanda bulundu.', { ner }).text // → "[KISI_1] beyanda bulundu."
```

---

## `turkish/suffix.ts` — Türkçe ek soyma

| Üye | İmza | Ne yapar | Hata |
|---|---|---|---|
| `nameKey` | `(root: string) => string` | Eşleme anahtarı: büyütür + son ünsüzü sertleştirir (`Ahmet`/`Ahmed` → `AHMET`) | — |
| `splitName` | `(word, isKnownRoot?) => SplitName` | Kelimeyi `{ root, suffix }`'e ayırır — önce kesme işareti, sonra bilinen köke dayalı soyma | — |

```ts
splitName("Ahmet'in") // → { root: 'Ahmet', suffix: "'in" }
nameKey('Ahmed') // → 'AHMET'
```

---

## `research/client.ts` — `ResearchClient` (A6, tek ağa çıkan modül)

```ts
const client = new ResearchClient({ transport, localIndex, ner })
const response = await client.search({ text: maskedQuery, kind: 'yargitay', limit })
```

- **İlk iş her zaman kapıdır**: `assertMasked` geçmezse hiçbir yan etki
  oluşmadan fırlar (M7.4).
- **Dönüş — `ResearchResponse`**: `{ documents, source, note? }` —
  `source`: `'network' | 'local' | 'unavailable'`.
- **Hata**: `UnmaskedContentError` (yalnız maskelenmemiş sorguda). Taşıma
  patlarsa hata **yutulur**, yerel dizine düşülür (M7.7) — asla fırlamaz.

```ts
try {
  const { documents, source } = await client.search({ text: masked, kind: 'yargitay' })
} catch (error) {
  if (error instanceof UnmaskedContentError) { /* önce mask() uygulanmalı */ }
}
```

---

## `research/guard.ts` — `MaskGuard` (M7.2/M7.3)

| Üye | İmza | Ne yapar | Hata |
|---|---|---|---|
| `assertMasked` | `(text, options?) => void` | Geçerse sessiz; kimlik verisi varsa fırlatır | `UnmaskedContentError` |
| `findUnmaskedContent` | `(text, options?) => readonly GuardFinding[]` | Bulunan varlıkları döner (ham değer taşımaz, yalnız `preview`) | — |

```ts
findUnmaskedContent('Ahmet Yılmaz beyanda bulundu', { ner })
// → [{ type: 'KISI', start, end, preview: 'Ah••••••az' }]
```

---

## `research/correlate.ts` — sonuç özetleme + olayla ilişkilendirme (M7.6)

```ts
function summarizeResults(documents, backend: SummaryBackend, options?: TopKOptions): Promise<TopKResult<DocumentSummary>>
function correlateResults(caseSummary, documents, backend: CorrelationBackend, options?: TopKOptions): Promise<TopKResult<DocumentCorrelation>>
```

- Her belge **backend'e TEK BAŞINA** verilir — imza bir çağrıda yalnız bir
  belge alır, birden çok kararı birleştirmenin API'de yolu yoktur (K bağımsız
  kısa geçiş, A6).
- **`options.limit`** (varsayılan 10): ilk-K sonuç işlenir; aşan adaylar
  `TopKResult.note`'ta bildirilir, sessizce yutulmaz.
- **Hata fırlatmaz** (backend kendi hatasını fırlatabilir, o zaman
  `Promise` reddedilir).

```ts
const { results, note } = await correlateResults(maskedCaseSummary, documents, backend, { limit: 5 })
// results[i].relevance, results[i].rationale — belge id'siyle eşleşir
```

---

## `write/*` — yazma katmanı (M8, deneysel — bkz. §Kararlılık)

### `write/skeleton.ts`

```ts
function extractSkeleton(text: string): DocumentSkeleton
```
Deterministik, model yok. Başlık listesi + baskın numaralandırma şeması
(`'roman' | 'arabic' | 'lettered' | 'mixed' | 'none'`) döner. Hata fırlatmaz.

```ts
extractSkeleton('I. OLAYLAR\n...\n\nII. HUKUKİ SEBEPLER\n...')
// → { numberingScheme: 'roman', sections: [
//     { heading: 'OLAYLAR', numbering: 'I', level: 0, lineIndex: 0 },
//     { heading: 'HUKUKİ SEBEPLER', numbering: 'II', level: 0, lineIndex: 3 },
//   ] }
```

### `write/styleProfile.ts`

```ts
function createEmptyProfile(): StyleProfile
function addDocument(profile: StyleProfile, text: string, options?: AddDocumentOptions): StyleProfile
function stdDev(distribution: Distribution): number
```

- **`addDocument`**: belge **TEK BAŞINA** işlenir, önceki belgelerin ham
  metnine ihtiyaç yoktur (M8.4). İçeride `text` önce `mask()`'tan geçirilir —
  profile giren örnek paragraf/hitap/kapanış **her zaman maskelenmiş**tir
  (S7 — `docs/QUESTIONS.md`). Saf fonksiyon, mevcut `profile`'ı değiştirmez,
  yenisini döner. Hata fırlatmaz.
- **`stdDev`**: `count === 0` ise `0` döner, çökmez.

```ts
let profile = createEmptyProfile()
for (const petition of oldPetitions) profile = addDocument(profile, petition)
profile.sentenceLength.mean // cümle uzunluğu ortalaması (kelime)
```

### `write/fewShot.ts`

```ts
function selectFewShot(target: string, candidates: readonly PetitionExample[], options?: FewShotOptions): FewShotSelection
```

- Benzerlik: kelime kümesi Jaccard'ı (model gerekmez). `options.limit`
  (varsayılan 3), `options.tokenBudget` (varsayılan 2000, `estimateTokens`
  ile ölçülür). Bütçeyi aşan aday elenir, daha küçük bir sonraki aday
  denenmeye devam edilir. Hata fırlatmaz; aşan varsa `note` doldurulur.

```ts
const { examples, usedTokens } = selectFewShot(targetPetitionText, pastPetitions)
```

### `write/staged.ts`

```ts
function writeSection(spec: SectionSpec, context: WriteContext, backend: WriteBackend): Promise<SectionResult>
function writeStaged(sections: readonly SectionSpec[], context: WriteContext, backend: WriteBackend): Promise<readonly SectionResult[]>
function checkConsistency(sections: readonly SectionResult[], options?: CheckConsistencyOptions): readonly ConsistencyIssue[]
function reviewSectionConsistency(sections: readonly SectionResult[], backend: ConsistencyReviewBackend): Promise<ConsistencyReview>
```

- **`writeSection`/`writeStaged`**: her bölüm **bağımsız çağrıda** yazılır,
  önceki bölümün tam metni prompt'a girmez (A13 §2). Prompt bütçeyi
  (2.000 token) aşarsa `TokenBudgetExceededError` — **sessizce kırpılmaz**.
- **`checkConsistency`**: DETERMİNİSTİK (numaralandırma/atıf/terim), model
  çağırmaz, hata fırlatmaz — bulguları liste olarak döner.
- **`reviewSectionConsistency`**: TÜM bölüm özetlerini **tek pencerede**
  backend'e verir (A13 §3 — burada bilerek birleştirme var, M7.6'nın K
  bağımsız kuralının tersi). Özet toplamı 1.500 token'ı aşarsa
  `TokenBudgetExceededError`.

```ts
const sections = await writeStaged(specs, { styleProfile: profile, fewShot: examples }, backend)
const issues = checkConsistency(sections, { styleProfile: profile })
const { report } = await reviewSectionConsistency(sections, reviewBackend)
```

### `write/types.ts`

```ts
function estimateTokens(text: string): number // ~4 karakter/token kaba tahmin
```
Gerçek bir tokenizer değildir — bağlam bütçesi kararları için üst sınır
denetimidir (bkz. dosya başı yorumu).

---

## `handoff/threshold.ts` — devir eşiği (M12.9)

```ts
function shouldOfferHandoff(job: JobEstimate, calibration: DeviceCalibration, device?: DeviceState): HandoffOutcome
```

- Dönüş `HandoffOutcome`: `{ kind: 'none' | 'offer' | 'postpone' | 'info', ... }`.
- **Eşik altında `kind` HER ZAMAN `'none'`** — bu davranış M12.9'da sınır
  değeriyle test edilir, burada yalnız belgelenir. Hata fırlatmaz.

```ts
shouldOfferHandoff({ foregroundWaitSeconds: 60, queueable: true }, { measured: true })
// → { kind: 'none' } — kuyruğa alınabilen iş ASLA devir tetiklemez
```

---

## `types/entities.ts` — ortak tipler

`ENTITY_TYPES` (11 tip: `TCKN`, `IBAN`, `TEL`, `EPOSTA`, `PLAKA`, `ESAS`,
`TARIH`, `KISI`, `KURUM`, `ISYERI`, `ADRES`) ve `TYPE_PRIORITY` (çakışma
çözümünde eşit uzunlukta kazanan sıra, SPEC §6.1). `EntitySpan`/`SuspectSpan`
tipleri kod boyunca ortak veri modelidir; doğrudan üretilmez, yalnız okunur.
