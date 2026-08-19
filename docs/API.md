# API — `packages/hukuk-ai` genel yüzeyi

Plan M13. Tek giriş noktası `src/index.ts`'tir (M13.1); burada belgelenen her
şey oradan dışa açılır, iç modüller doğrudan import edilmez.

Çapraz bağlar: madde numaraları `docs/SPEC.md` (maskeleme sözleşmesi) ve
`docs/PROTOCOL.md` (devir teslim sözleşmesi) bölümlerine işaret eder — S1, G1
gibi kodlar o belgelerdeki maddelerdir.

---

## 0. Kararlılık sözü (M13.5)

| Durum | Anlamı | Kapsam |
|---|---|---|
| **Kararlı** | İmza değişmeden önce plan güncellenir, bu belge güncellenir, `PLAN-HUKUKAI.md` günlüğüne yazılır | `mask`, `unmask`, `maskAsync`, `MaskTable`, `MaskReview`, `preflightCheck`, `ResearchClient`, `assertMasked`/`findUnmaskedContent`, `runRuleLayer` ve tüm tip tanımları |
| **Deneysel** | İmza plan ilerledikçe değişebilir; henüz gerçek kullanım turu görmedi | `relateDocumentsToCase`/`summarizeDocument*` (M7.6, tek oturumda yazıldı), tüm `src/write/*` yüzeyi (M8, tek oturumda yazıldı) |
| **Bilinçli eksik** | Plan maddesi devam ediyor; API tamamlanmadı | `MaskTable.exportEncrypted`/`importEncrypted` şifreleme parametreleri ileride sertleşebilir (M9 sonrası donanım ölçümüyle) |

Deneysel yüzeyler çalışır ve testlidir (M7.6: 12 test, M8: 34 test) ama henüz
gerçek `DraftBackend`/`SummaryBackend` uygulamasıyla (bir model arkasında)
denenmedi — sözleşme model entegrasyonunda küçük ayarlamalar isteyebilir.

---

## 1. Maskeleme — `mask`, `maskAsync`, `unmask`

### `mask(input: string, options?: MaskOptions): MaskResult`

Metni maskeler (SPEC §3, §6). Senkrondur — yalnız kural katmanı + (verilirse)
senkron `NerBackend` koşar.

**Parametreler**
- `input: string` — ham metin.
- `options.table?: MaskTable` — var olan tabloya ekler; aynı dosyanın birden
  çok belgesinde kişi kimliği tutarlı kalsın diye (SPEC §4.2).
- `options.maskDates?: boolean` — `false` verilirse tarihler maskelenmez
  (SPEC §7/8). Varsayılan `true`.
- `options.ner?: NerBackend` — verilmezse yalnız kural katmanı çalışır (SPEC §7/2).

**Döner:** `MaskResult { text, table, spans, suspects }`
- `text` — maskelenmiş metin.
- `table` — kullanılan/oluşturulan `MaskTable` (ağa çıkmaz, bkz. §4).
- `spans` — maskelenen aralıklar (kaçışlanmış metne göre konum).
- `suspects` — doğrulamadan geçemeyen adaylar; sessizce yutulmaz (SPEC §7/3).

**Fırlatabileceği hatalar:** yok. Bozuk/boş girdide de çökmez.

```ts
import { mask, unmask } from '@juriscalendar/hukuk-ai'

const result = mask('Müvekkil Ahmet Yılmaz, TC 10000000146.')
// result.text === 'Müvekkil [KISI_1], TC [TCKN_1].'
const back = unmask(result.text, result.table)
// back.text === 'Müvekkil Ahmet Yılmaz, TC 10000000146.'
```

### `maskAsync(input: string, options?: MaskAsyncOptions): Promise<MaskResult>`

`mask` ile aynı; `options.ner` bir `AsyncNerBackend` de olabilir (cihaz içi
model çıkarımı eşzamansızdır, bkz. `MODEL.md` §3.1). Diğer her şey birebir.

### `unmask(text: string, table: MaskTable): UnmaskResult`

Token'ları ham metne çevirir; aynı token'ın n'inci geçişi tablodaki n'inci ham
yazımla değişir (SPEC S1 — birebirlik).

**Döner:** `UnmaskResult { text, unresolved }` — `unresolved`, tabloda karşılığı
olmayan token'lar (SPEC §5.1); boş değilse arayüz kullanıcıyı uyarmalı.

**Fırlatabileceği hatalar:** yok. Bilinmeyen/bozuk token aynen bırakılır.

---

## 2. `MaskTable`

`SPEC.md` §4 — deterministik eşleme tablosu. **Kırmızı çizgi:** `toJSON()`
kasıtlı olarak fırlatır; tablo hiçbir koşulda düz metin serileştirilip ağa
gönderilemez (SPEC S2 / PROTOCOL G1).

| Üye | İmza | Açıklama |
|---|---|---|
| `size` | `get size(): number` | Kayıt sayısı |
| `tokenFor` | `(type, key, surface, index) => string` | Anahtar için token verir/oluşturur (SPEC S4) |
| `surfaceAt` | `(token, nth) => string \| undefined` | n'inci geçişin ham yazımı |
| `lookup` | `(token) => MaskEntry \| undefined` | Token → kayıt |
| `hasKey` | `(type, key) => boolean` | — |
| `tokenOf` | `(type, key) => string \| undefined` | Anahtar → token |
| `markAmbiguous` | `(token, candidates?) => void` | SPEC §7/7 — belirsizlik işaretle |
| `entries` | `() => readonly MaskEntry[]` | Onay ekranı için (M6.1), ilk geçiş sırasına göre |
| `remove` | `(token) => boolean` | Kaydı kaldırır (M6.4) |
| `clear` | `() => void` | Oturum sonu (M5.7) |
| `digest` | `() => Promise<string>` | **Ağa çıkabilen TEK biçim** — `sha256:...` (PROTOCOL §5.3 `maskTableHash`) |
| `toJSON` | `() => never` | **Her zaman fırlatır** — `MaskTableSerializationError` |
| `exportEncrypted` | `(passphrase, iterations?) => Promise<EncryptedMaskTable>` | Cihazda saklamak için şifreli dışa aktarım (M5.7) |
| `MaskTable.importEncrypted` (static) | `(blob, passphrase) => Promise<MaskTable>` | Şifreli blob'dan geri kurar |

**Fırlatabileceği hatalar:**
- `toJSON()` → her zaman `MaskTableSerializationError`.
- `exportEncrypted(passphrase)` → parola 8 karakterden kısaysa `MaskTableSerializationError`.
- `MaskTable.importEncrypted(blob, passphrase)` → biçim uyuşmuyorsa veya
  parola/veri bozuksa `MaskTableDecryptError`. **Yanlış parola ile bozuk veri
  ayırt edilmez** (kasıtlı — hata mesajı bunu söyler).

```ts
const table = new MaskTable()
const encrypted = await table.exportEncrypted('en-az-8-karakter')
const restored = await MaskTable.importEncrypted(encrypted, 'en-az-8-karakter')
const hash = await table.digest() // ağa gidebilecek tek şey
```

---

## 3. `MaskReview` — onay ekranı API'si

Plan M6. Saf veri döndürür, DOM'a dokunmaz. Her müdahalede maskeleme baştan
koşar (M6.6 tutarlılık garantisi bunun sonucu).

| Üye | İmza | Açıklama |
|---|---|---|
| constructor | `new MaskReview(originalText, options?: MaskOptions)` | — |
| `sourceText` | `get sourceText(): string` | Kaçışlanmış kaynak metin; tüm aralıklar buna göre |
| `maskedText` | `get maskedText(): string` | Güncel maskelenmiş metin |
| `table` | `get table(): MaskTable` | Güncel tablo |
| `result` | `get result(): MaskResult` | Güncel tam sonuç |
| `listMasks` | `() => readonly ReviewMask[]` | M6.1 — maske listesi |
| `addMask` | `(range: TextRange, type: EntityType) => string` | M6.2 — elle ekle, token döner |
| `linkToExisting` | `(range, token) => void` | M6.3 — mevcut maskeye bağla |
| `removeMask` | `(token) => void` | M6.4 — kaldır |
| `applyToAll` | `(range, type) => string` | M6.5 — kökün tüm çekimli biçimlerine uygula |

**Fırlatabileceği hatalar (hepsi `MaskReviewError`):**
- `addMask`/`linkToExisting`/`applyToAll` — `range` metin sınırları dışında,
  tamsayı değil, ya da `end <= start`.
- `linkToExisting`/`removeMask` — bilinmeyen `token`.
- `addMask`/`applyToAll` — token üretilemezse (pratikte oluşmaz, iç tutarlılık
  güvencesidir).

```ts
const review = new MaskReview('Müvekkil Ahmet Yılmaz aradı.')
const token = review.addMask({ start: 9, end: 21 }, 'KISI')
review.listMasks() // → [{ token, type: 'KISI', canonical: 'Ahmet Yılmaz', ... }]
```

---

## 4. `preflightCheck` — kaçak kimlik bilgisi yakalama

Plan M11. `MaskGuard`'ın (bkz. §6) YERİNE geçmez, ondan önce gelir.

### `preflightCheck(text: string, options: PreflightOptions): PreflightResult`

**Parametreler:** `options.destination: 'local' | 'network'` zorunlu; geri
kalanı `MaskOptions` ile aynı.

**Döner:** `PreflightResult { clean, entities, suspects, maskedPreview, canSendUnmasked }`
- `clean` — kimlik verisi yoksa `true`.
- `canSendUnmasked` — **`destination: 'network'` iken her zaman `false`**
  (M11.5). Arayüz bu bayrağa bakıp "maskesiz gönder" düğmesini hiç çizmemeli.

**Fırlatabileceği hatalar:** yok.

```ts
const preflight = preflightCheck('TC 10000000146 ile arandı', { destination: 'network' })
// preflight.clean === false
// preflight.canSendUnmasked === false  → arayüz "maskesiz gönder" seçeneğini göstermez
```

---

## 5. `ResearchClient` — araştırma katmanı (A6)

Plan M7. **İnternete çıkan TEK modül.** Ağın kendisi (`ResearchTransport`)
dışarıdan verilir; paket ağ API'sine hiç dokunmaz.

### `new ResearchClient(options?: ResearchClientOptions)`

- `options.transport?: ResearchTransport` — ağa çıkan taşıma (dışarıdan).
- `options.localIndex?: LocalResearchIndex` — çevrimdışı yedek (M7.7).
- `options.ner?: NerBackend` — kapının (bkz. §6) ad/kurum/adres de görmesi için.

### `client.search(query: ResearchQuery): Promise<ResearchResponse>`

**İLK İŞ kapıdır** — `assertMasked` geçmeden taşımaya, yerel dizine, hiçbir
yere hiçbir şey gitmez.

**Döner:** `ResearchResponse { documents, source, note? }` — `source`:
`'network' | 'local' | 'unavailable'`. Ağ patlarsa hata fırlatmaz, yerel
dizine düşer (M7.7); yerel dizin de yoksa boş liste + `note`.

**Fırlatabileceği hatalar:** `UnmaskedContentError` — `query.text` maskelenmemiş
kimlik verisi taşıyorsa (kaçış yolu yok, M7.4).

```ts
const client = new ResearchClient({ transport: myHttpTransport })
const { text } = mask('Müvekkilim Ahmet Yılmaz için emsal karar arıyorum')
const response = await client.search({ text, kind: 'yargitay' })
```

---

## 6. `MaskGuard` — `assertMasked`, `findUnmaskedContent`

Plan M7.2/M7.3. `ResearchClient.search`'ün kullandığı kapının kendisi;
doğrudan da çağrılabilir.

### `findUnmaskedContent(text: string, options?: GuardOptions): readonly GuardFinding[]`

Kural katmanını (ve verilirse NER'i) **ters yönde** koşturup bulunan kimlik
verilerini listeler. `GuardFinding.preview` ham değeri taşımaz
(`05••••••••33` gibi maskeli önizleme).

### `assertMasked(text: string, options?: GuardOptions): void`

Geçerse sessiz; geçmezse fırlatır.

**Fırlatabileceği hatalar:** `UnmaskedContentError` — `findings` alanında
bulunan tipler (ham değer yok, `error.message` de ham değer içermez).

---

## 7. Karar özetleme ve olayla ilişkilendirme — `relate.ts` (A6, M7.6)

*Deneysel.* Cihaz içi özetleme/ilişkilendirme modeli takılabilir
(`SummaryBackend`) — model bu pakete dahil değildir.

### `summarizeDocument(document: ResearchDocument, backend: SummaryBackend): Promise<DocumentSummary>`

Tek kararı özetler, diğerlerinden bağımsız.

### `summarizeDocuments(documents, backend, options?: RelateOptions): Promise<readonly DocumentSummary[]>`

İlk-K kararı (varsayılan `DEFAULT_RELATE_LIMIT`) tek tek özetler.

### `relateDocumentsToCase(documents, caseSummary: string, backend, options?: RelateOptions): Promise<readonly CaseRelevance[]>`

**A6 kuralı — K bağımsız kısa geçiş:** her karar `backend.relateToCase`'e
KENDİ çağrısında girer; hiçbir çağrıda birden fazla kararın metni birlikte
bulunmaz.

**Fırlatabileceği hatalar:** `CaseSummaryTooLongError` — `caseSummary` tahmini
`CASE_SUMMARY_TOKEN_BUDGET` (800 token) sınırını aşarsa; bu durumda backend'e
**hiç** çağrı yapılmaz.

```ts
const relevances = await relateDocumentsToCase(
  searchResponse.documents,
  maskedCaseSummary,
  myLocalModelBackend,
  { limit: 10 },
)
```

---

## 8. Yazma katmanı — `src/write/*` (A8/A9/A13, M8)

*Deneysel.* Fine-tuning ile başlanmaz (M8.6 kararı, bkz. `MODEL.md` §4 ve
`TRAINING.md`); bu yüzden bu katmanda üretim modeli yoktur, yalnız
**yapı çıkarma → üslup profili → few-shot seçimi → aşamalı üretim** boru
hattı vardır. Ağa hiç çıkmaz (M8.1).

### `extractStructure(text: string): PetitionStructure`

Eski bir dilekçeden başlık düzenini, numaralandırma biçimini ve bölüm sırasını
çıkarır (M8.2). Tamamen deterministiktir, hata fırlatmaz.

```ts
const structure = extractStructure(oldPetitionText)
// structure.numberingStyle === 'arabic'
// structure.sectionOrder === ['AÇIKLAMALAR', 'HUKUKİ SEBEPLER', 'SONUÇ VE İSTEM']
```

### `buildStyleProfile(text: string, numberingStyle?: NumberingStyle): StyleProfile`

Tek belgeden istatistik profili çıkarır (M8.3): cümle/paragraf uzunluğu
histogramı, açılış/kapanış cümlesi, atıf biçimi, terim tercihi, belge içi
tekrardan çıkarılan kalıp ifadeler. Hata fırlatmaz.

### `mergeStyleProfiles(a: StyleProfile, b: StyleProfile): StyleProfile` / `addDocumentToProfile(profile, text, numberingStyle?): StyleProfile`

Toplamsal birleştirme (M8.4) — `addDocumentToProfile(emptyStyleProfile(), d1)`
sonra `addDocumentToProfile(..., d2)` yapmak, `mergeStyleProfiles(profil(d1), profil(d2))`
ile **birebir aynı** sonucu verir (testle doğrulanır). Değişmeli: `a+b === b+a`.

```ts
let profile = emptyStyleProfile()
for (const petition of oldPetitions) profile = addDocumentToProfile(profile, petition.text)
```

### `selectFewShotExamples(query: string, candidates: readonly FewShotCandidate[], options?: FewShotOptions): readonly FewShotSelection[]`

En benzer (Jaccard kelime kümesi benzerliği) 2–3 dilekçeyi seçer (M8.5),
`FEW_SHOT_TOKEN_BUDGET` (2.000 token tahmini) toplam bütçesine sığdırarak.
Sığmayan büyük aday atlanır, sıradaki denenir. Hata fırlatmaz, boş listede
boş döner.

### `generateDraft(input: DraftInput, backend: DraftBackend, context?: SectionContext): Promise<DraftResult>`

A13'ün üç aşamasını koşar (M8.7): `planSkeleton` → bölüm bölüm `writeSection`
(her bölüm kendi çağrısında, `SECTION_TOKEN_BUDGET` = 2.000 token penceresi) →
`reviewConsistency`. **Tip düzeyinde zorlanan kural:** tutarlılık geçişi
`SectionSummary[]` alır (yalnız `heading` + `summary`), `DraftSection[]`
(tam metin) DEĞİL — bölümlerin tam metni fiziken bu çağrıya giremez.

**Fırlatabileceği hatalar:** `ConsistencySummaryTooLongError` — bölüm
özetlerinin toplamı `CONSISTENCY_SUMMARY_BUDGET` (2.000 token tahmini) sınırını
aşarsa; bu durumda `reviewConsistency` **hiç** çağrılmaz.

```ts
const draft = await generateDraft(
  { caseSummary: maskedCaseSummary, structure },
  myLocalDraftBackend,
  { styleProfile, fewShotExamples: selectFewShotExamples(maskedCaseSummary, pastPetitions) },
)
```

---

## 9. Diğer yardımcılar

| Fonksiyon | İmza | Not |
|---|---|---|
| `runRuleLayer` | `(text, options?: RuleLayerOptions) => RuleResult` | Yalnız kural katmanı; `MaskGuard` ve `mask()` bunu kullanır |
| `isValidTckn` | `(value: string) => boolean` | Resmî TCKN doğrulama algoritması (M2.1) |
| `isValidIban` | `(value: string) => boolean` | Mod-97 (M2.2) |
| `normalizePhone` | `(value: string) => string` | — |
| `isMaskToken` | `(candidate: string) => boolean` | Bir dizge gerçek maske token'ı mı |
| `nameKey` | `(root: string) => string` | Türkçe ünsüz sertleştirmeli eşleme anahtarı |
| `splitName` | `(word, isKnownRoot?) => SplitName` | Çekim eki ayırma (M4) |
| `createDictionaryNerBackend` | `(options?: DictionaryNerOptions) => NerBackend` | Modelsiz varsayılan NER (M3.3) |
| `freeRegions` | `(textLength, taken) => readonly FreeRegion[]` | Kural katmanının dokunmadığı boşluklar |
| `shouldOfferHandoff` | `(job, calibration, device?) => HandoffOutcome` | Devir teslim eşiği (`CAPABILITIES.md` §C, M12.9) |

---

## 10. Hata tipleri kataloğu (M13.3)

| Tip | Nereden | Ne zaman | Ham veri taşır mı |
|---|---|---|---|
| `UnmaskedContentError` | `research/guard.ts` | `assertMasked`/`ResearchClient.search` maskelenmemiş kimlik verisi görünce | **Hayır** — `findings[].preview` maskeli, `message` tipleri sayar |
| `MaskTableSerializationError` | `mask/table.ts` | `table.toJSON()` her zaman; `exportEncrypted` kısa parolada | Hayır |
| `MaskTableDecryptError` | `mask/table.ts` | `importEncrypted` yanlış parola/bozuk veri/bilinmeyen biçim | Hayır |
| `MaskReviewError` | `mask/review.ts` | Geçersiz aralık, bilinmeyen token | Hayır (yalnız konum/token bilgisi) |
| `CaseSummaryTooLongError` | `research/relate.ts` | `caseSummary` bütçeyi aşınca | Hayır (yalnız tahmini token sayısı) |
| `ConsistencySummaryTooLongError` | `write/draft.ts` | Bölüm özetleri toplamı bütçeyi aşınca | Hayır (yalnız tahmini token sayısı) |

Ortak desen: **hiçbir hata nesnesi ham kişisel veri taşımaz.** Bir hata
nesnesi de bir sızıntı yüzeyidir; bu paket boyunca bilinçli bir kural.
